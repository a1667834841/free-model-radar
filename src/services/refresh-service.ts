import type { RadarEnv } from '@/domain/env'
import { getSecret } from '@/domain/env'
import type { ProviderConfig } from '@/domain/provider'
import type { ModelResult, ProviderResult, ResultsSnapshot } from '@/domain/result'
import { selectModelsForProbe, type DiscoveredModel } from '@/domain/model'
import { createRefreshId, type RefreshJob, type RefreshJobProvider, type RefreshQueueMessage } from '@/domain/refresh'
import { getProviderConfig } from '@/storage/provider-config-store'
import { deleteRefreshJob, getRefreshJob, putLatestResults, putRefreshJob, putRefreshStatus } from '@/storage/results-store'
import { getModelHealthState, putModelHealthState } from '@/storage/model-health-store'
import { acquireRefreshLock, releaseRefreshLock } from '@/storage/refresh-lock'
import { discoverModels } from './provider-discovery'
import { probeModel } from './model-prober'
import { isModelHidden, recordModelFailure, recordModelSuccess, type ModelHealthState } from './model-health-service'

import { safeErrorMessage } from '@/lib/json'

export type StartRefreshResult =
  | { accepted: true; refreshId: string }
  | { accepted: false; status: number; error: string }

const DEFAULT_REFRESH_PROGRESS = { completed: 0, total: 0 }
const MAX_MODELS_PER_INVOCATION = 5

function log(refreshId: string, message: string, meta?: Record<string, unknown>): void {
  const detail = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  console.log(`[refresh:${refreshId}] ${new Date().toISOString()} ${message}${detail}`)
}

export async function startRefresh(env: RadarEnv, queue: Queue<RefreshQueueMessage>, fetchImpl: typeof fetch = fetch): Promise<StartRefreshResult> {
  const startedAt = Date.now()
  const existingJob = await getRefreshJob(env.RADAR_KV)
  const refreshId = existingJob?.refreshId ?? createRefreshId()

  let locked: boolean
  try {
    locked = await acquireRefreshLock(env.RADAR_KV, refreshId)
  } catch (error) {
    // KV 偶发 500 时不要让手动触发失败；入队后由 consumer 兜底重试。
    log(refreshId, 'startRefresh: lock probe threw (KV error), enqueueing anyway', { error: safeErrorMessage(error), tookMs: Date.now() - startedAt })
    try {
      await queue.send({ refreshId, isNewRefresh: !existingJob })
    } catch (queueError) {
      log(refreshId, 'startRefresh: queue.send FAILED after lock probe error', { error: safeErrorMessage(queueError) })
      return { accepted: false, status: 500, error: 'Failed to enqueue refresh' }
    }
    return { accepted: true, refreshId }
  }

  if (!locked) {
    // 已有任务在跑（或刚结束、锁尚未释放）。若 job 仍是同一 refreshId，说明刷新还在进行，幂等返回 202；否则 409。
    const currentJob = await getRefreshJob(env.RADAR_KV)
    log(refreshId, 'startRefresh: lock busy', {
      sameRefreshId: currentJob?.refreshId === refreshId,
      currentJobRefreshId: currentJob?.refreshId ?? null,
      tookMs: Date.now() - startedAt,
    })
    if (currentJob?.refreshId === refreshId) {
      return { accepted: true, refreshId }
    }
    return { accepted: false, status: 409, error: 'Refresh already running' }
  }

  // 只探测锁，真正的锁由 Queue consumer 按批获取。
  await releaseRefreshLock(env.RADAR_KV)

  if (!existingJob) {
    await putRefreshStatus(env.RADAR_KV, {
      status: 'running',
      refreshId,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      configVersion: null,
      progress: DEFAULT_REFRESH_PROGRESS,
    })
  }

  log(refreshId, 'startRefresh: enqueueing refresh', { isNewRefresh: !existingJob, tookMs: Date.now() - startedAt })
  try {
    await queue.send({ refreshId, isNewRefresh: !existingJob })
  } catch (error) {
    log(refreshId, 'startRefresh: queue.send FAILED', { error: safeErrorMessage(error) })
    return { accepted: false, status: 500, error: 'Failed to enqueue refresh' }
  }
  return { accepted: true, refreshId }
}

export async function runRefresh(env: RadarEnv, refreshId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const startedAt = new Date().toISOString()
  const runStartMs = Date.now()
  try {
    const t0 = Date.now()
    const config = await getProviderConfig(env.RADAR_KV)
    let job = await getRefreshJob(env.RADAR_KV)
    log(refreshId, 'runRefresh: config+job loaded', { tookMs: Date.now() - t0, configVersion: config.version, existingJobId: job?.refreshId ?? null, existingCompleted: job?.completed ?? null, existingTotal: job?.total ?? null })

    if (!job || job.refreshId !== refreshId || job.configVersion !== config.version) {
      const t1 = Date.now()
      job = await createRefreshJob(env, refreshId, config.providers.filter((provider) => provider.enabled), config.version, fetchImpl)
      log(refreshId, 'runRefresh: created new job', { tookMs: Date.now() - t1, total: job.total, providers: job.providers.length })
      await putRefreshJob(env.RADAR_KV, job)
      await putRefreshStatus(env.RADAR_KV, {
        status: 'running',
        refreshId,
        startedAt: job.startedAt,
        finishedAt: null,
        error: null,
        configVersion: config.version,
        progress: { completed: 0, total: job.total },
      })
    }

    const healthState = await getModelHealthState(env.RADAR_KV)
    const batch = await processNextBatch(job, env, healthState, fetchImpl)
    job = batch.job
    await putModelHealthState(env.RADAR_KV, batch.healthState)
    log(refreshId, 'runRefresh: batch processed', { completed: job.completed, total: job.total, tookMs: Date.now() - runStartMs })

    if (job.completed < job.total) {
      await putRefreshJob(env.RADAR_KV, job)
      await putRefreshStatus(env.RADAR_KV, {
        status: 'running',
        refreshId,
        startedAt: job.startedAt,
        finishedAt: null,
        error: null,
        configVersion: config.version,
        progress: { completed: job.completed, total: job.total },
      })
      return
    }

    log(refreshId, 'runRefresh: all models done, writing final snapshot', { total: job.total })

    const snapshot: ResultsSnapshot = {
      updatedAt: new Date().toISOString(),
      refreshId,
      providers: job.providers.map(toProviderResult),
    }
    await putLatestResults(env.RADAR_KV, snapshot)
    await deleteRefreshJob(env.RADAR_KV)
    await putRefreshStatus(env.RADAR_KV, {
      status: 'success',
      refreshId,
      startedAt: job.startedAt,
      finishedAt: new Date().toISOString(),
      error: null,
      configVersion: config.version,
      progress: { completed: job.total, total: job.total },
    })
  } catch (error) {
    log(refreshId, 'runRefresh: FAILED', { error: safeErrorMessage(error), tookMs: Date.now() - runStartMs })
    await putRefreshStatus(env.RADAR_KV, {
      status: 'failed',
      refreshId,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: safeErrorMessage(error),
      configVersion: null,
      progress: null,
    })
    await deleteRefreshJob(env.RADAR_KV)
  } finally {
    // 锁由调用方（Queue consumer）负责释放，这里只记录耗时。
    log(refreshId, 'runRefresh: done', { tookMs: Date.now() - runStartMs })
  }
}

/**
 * Queue consumer 入口：按批处理一次刷新。
 *
 * 锁按“批”获取：每批处理后释放，若还有剩余模型则继续入队下一批。
 * 这种模式下不需要前端再发接力请求，也不会有 waitUntil 长任务占住 isolate。
 */
export async function processRefreshMessage(env: RadarEnv, queue: Queue<RefreshQueueMessage>, message: RefreshQueueMessage, fetchImpl: typeof fetch = fetch): Promise<void> {
  const { refreshId, isNewRefresh } = message

  // 过期/重复消息：job 不存在且不是新任务 → 跳过。
  const preJob = await getRefreshJob(env.RADAR_KV)
  if (!isNewRefresh && (!preJob || preJob.refreshId !== refreshId)) {
    log(refreshId, 'queue: stale message skipped (no matching job)')
    return
  }
  if (preJob && preJob.completed >= preJob.total) {
    log(refreshId, 'queue: stale message skipped (job already complete)')
    return
  }

  let locked: boolean
  try {
    locked = await acquireRefreshLock(env.RADAR_KV, refreshId)
  } catch (error) {
    log(refreshId, 'queue: lock acquire threw, will retry', { error: safeErrorMessage(error) })
    throw error
  }

  if (!locked) {
    // 锁被占用：可能是同一任务另一条消息在跑，或上一批刚结束、锁尚未释放。
    // 若任务仍活跃，延迟重发自己，避免刷新中途停滞。
    const currentJob = await getRefreshJob(env.RADAR_KV)
    if (currentJob && currentJob.refreshId === refreshId && currentJob.completed < currentJob.total) {
      log(refreshId, 'queue: lock busy, re-enqueueing with delay')
      await queue.send({ refreshId }, { delaySeconds: 5 })
    } else {
      log(refreshId, 'queue: lock busy, skipping (job not active)')
    }
    return
  }

  try {
    // 拿到锁后再次确认 job 状态，避免重建已完成的任务。
    const job = await getRefreshJob(env.RADAR_KV)
    if (!isNewRefresh && (!job || job.refreshId !== refreshId)) {
      log(refreshId, 'queue: skipped after lock (job vanished)')
      return
    }
    if (job && job.completed >= job.total) {
      log(refreshId, 'queue: skipped after lock (job complete)')
      return
    }

    await runRefresh(env, refreshId, fetchImpl)

    // 若还有剩余模型，继续入队下一批。
    const nextJob = await getRefreshJob(env.RADAR_KV)
    if (nextJob && nextJob.completed < nextJob.total) {
      log(refreshId, 'queue: more work, enqueueing next batch', { completed: nextJob.completed, total: nextJob.total })
      await queue.send({ refreshId })
    } else {
      log(refreshId, 'queue: refresh finished')
    }
  } finally {
    await releaseRefreshLock(env.RADAR_KV)
  }
}

async function createRefreshJob(
  env: RadarEnv,
  refreshId: string,
  providers: ProviderConfig[],
  configVersion: number,
  fetchImpl: typeof fetch,
): Promise<RefreshJob> {
  const healthState = await getModelHealthState(env.RADAR_KV)
  const jobProviders: RefreshJobProvider[] = []

  for (const provider of providers) {
    const t = Date.now()
    try {
      const apiKey = getSecret(env, provider.secretName)
      const discoveredModels = await discoverModels(provider, apiKey, fetchImpl)
      const visibleModels = discoveredModels.filter((model) => !isModelHidden(healthState, provider.id, model.id))
      const selectedModels = selectModelsForProbe(provider, visibleModels)
      jobProviders.push({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl, models: selectedModels, cursor: 0, successfulModels: [] })
      log(refreshId, 'discover: ok', { provider: provider.id, discovered: discoveredModels.length, visible: visibleModels.length, selected: selectedModels.length, tookMs: Date.now() - t })
    } catch (error) {
      jobProviders.push({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl, models: [], cursor: 0, successfulModels: [] })
      log(refreshId, 'discover: FAILED', { provider: provider.id, error: safeErrorMessage(error), tookMs: Date.now() - t })
    }
  }

  return {
    refreshId,
    configVersion,
    startedAt: new Date().toISOString(),
    providers: jobProviders,
    completed: 0,
    total: jobProviders.reduce((total, provider) => total + provider.models.length, 0),
  }
}

async function processNextBatch(
  job: RefreshJob,
  env: RadarEnv,
  healthState: ModelHealthState,
  fetchImpl: typeof fetch,
): Promise<{ job: RefreshJob; healthState: ModelHealthState }> {
  let nextHealthState = healthState
  const nextProviders = job.providers.map((provider) => ({ ...provider, successfulModels: [...provider.successfulModels] }))
  let completed = job.completed
  const config = await getProviderConfig(env.RADAR_KV)
  const providerConfigById = new Map(config.providers.map((provider) => [provider.id, provider]))
  const providerAccessById = new Map<string, { provider: ProviderConfig; apiKey: string } | null>()
  const batchModels: Array<{ providerIndex: number; provider: ProviderConfig; apiKey: string; model: DiscoveredModel }> = []

  function getProviderAccess(jobProvider: RefreshJobProvider): { provider: ProviderConfig; apiKey: string } | null {
    if (providerAccessById.has(jobProvider.id)) {
      return providerAccessById.get(jobProvider.id) ?? null
    }

    const provider = providerConfigById.get(jobProvider.id)
    if (!provider) {
      providerAccessById.set(jobProvider.id, null)
      return null
    }

    try {
      const apiKey = getSecret(env, provider.secretName)
      const access = { provider, apiKey }
      providerAccessById.set(jobProvider.id, access)
      return access
    } catch {
      providerAccessById.set(jobProvider.id, null)
      return null
    }
  }

  while (batchModels.length < MAX_MODELS_PER_INVOCATION) {
    let added = false

    for (let index = 0; index < nextProviders.length && batchModels.length < MAX_MODELS_PER_INVOCATION; index += 1) {
      const jobProvider = nextProviders[index]
      if (jobProvider.cursor >= jobProvider.models.length) continue

      const access = getProviderAccess(jobProvider)
      if (!access) {
        completed += jobProvider.models.length - jobProvider.cursor
        jobProvider.cursor = jobProvider.models.length
        continue
      }

      const model = jobProvider.models[jobProvider.cursor]
      jobProvider.cursor += 1
      batchModels.push({ providerIndex: index, provider: access.provider, apiKey: access.apiKey, model })
      added = true
    }

    if (!added) break
  }

  if (batchModels.length === 0) {
    return { job: { ...job, providers: nextProviders, completed }, healthState: nextHealthState }
  }

  log(job.refreshId, 'processNextBatch: probing batch', { batchSize: batchModels.length, completedBefore: job.completed, total: job.total })
  const batchStartMs = Date.now()
  const probeResults = await Promise.all(batchModels.map(async (item) => {
    const t = Date.now()
    const probeResult = await probeModel(item.provider, item.apiKey, item.model.id, fetchImpl)
    log(job.refreshId, 'processNextBatch: probe result', {
      provider: item.provider.id,
      model: item.model.id,
      ok: probeResult.ok,
      latencyMs: probeResult.ok ? probeResult.latencyMs : null,
      error: probeResult.ok ? undefined : probeResult.error,
      tookMs: Date.now() - t,
    })
    return { ...item, probeResult }
  }))
  log(job.refreshId, 'processNextBatch: batch probed', { batchSize: batchModels.length, tookMs: Date.now() - batchStartMs })

  for (const { providerIndex, provider, probeResult } of probeResults) {
    const jobProvider = nextProviders[providerIndex]
    completed += 1
    if (probeResult.ok) {
      nextHealthState = recordModelSuccess(nextHealthState, provider.id, probeResult.modelId, probeResult.checkedAt)
      jobProvider.successfulModels.push({
        id: probeResult.modelId,
        latencyMs: probeResult.latencyMs,
        ttftMs: probeResult.ttftMs,
        tokensPerSec: probeResult.tokensPerSec,
        availability: 'available',
        freeStatus: probeResult.freeStatus,
        prompt: probeResult.prompt,
        content: probeResult.content,
        tokenUsage: probeResult.tokenUsage,
        checkedAt: probeResult.checkedAt,
      })
    } else {
      nextHealthState = recordModelFailure(nextHealthState, provider.id, probeResult.modelId, probeResult.checkedAt)
    }
  }

  return { job: { ...job, providers: nextProviders, completed }, healthState: nextHealthState }
}

function toProviderResult(provider: RefreshJobProvider): ProviderResult {
  const models: ModelResult[] = [...provider.successfulModels].sort((a, b) => {
    if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
    return a.id.localeCompare(b.id)
  })
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    status: models.length > 0 ? 'healthy' : 'empty',
    models,
  }
}
