import type { ResultsSnapshot } from '@/domain/result'
import type { RefreshStatus, RefreshJob } from '@/domain/refresh'
import { safeErrorMessage } from '@/lib/json'
import { KV_KEYS } from './kv-keys'
import { getRefreshRuntimeState, patchRefreshRuntimeState } from './refresh-runtime-store'

export async function getRefreshJob(kv: KVNamespace): Promise<RefreshJob | null> {
  return (await getRefreshRuntimeState(kv)).refreshJob
}

export async function putRefreshJob(kv: KVNamespace, job: RefreshJob): Promise<void> {
  await patchRefreshRuntimeState(kv, { refreshJob: job })
}

export async function deleteRefreshJob(kv: KVNamespace): Promise<void> {
  await patchRefreshRuntimeState(kv, { refreshJob: null })
}

export async function getLatestResults(kv: KVNamespace): Promise<ResultsSnapshot | null> {
  const value = await kv.get(KV_KEYS.latestResults)
  return value ? JSON.parse(value) as ResultsSnapshot : null
}

export async function putLatestResults(kv: KVNamespace, snapshot: ResultsSnapshot): Promise<void> {
  await kv.put(KV_KEYS.latestResults, JSON.stringify(snapshot))
}

export async function getRefreshStatus(kv: KVNamespace): Promise<RefreshStatus> {
  const status = (await getRefreshRuntimeState(kv)).refreshStatus
  return status ?? { status: 'idle', refreshId: null, startedAt: null, finishedAt: null, error: null, configVersion: null, progress: null }
}

const REFRESH_STATUS_GET_ATTEMPTS = 3
const REFRESH_STATUS_GET_RETRY_DELAY_MS = 150

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getRefreshStatusOrTransient(kv: KVNamespace): Promise<RefreshStatus & { transientError?: string }> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < REFRESH_STATUS_GET_ATTEMPTS; attempt += 1) {
    try {
      return await getRefreshStatus(kv)
    } catch (error) {
      lastError = error
      if (attempt < REFRESH_STATUS_GET_ATTEMPTS - 1) {
        await sleep(REFRESH_STATUS_GET_RETRY_DELAY_MS)
      }
    }
  }

  return {
    status: 'running',
    refreshId: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    configVersion: null,
    progress: null,
    transientError: `Refresh status temporarily unavailable: ${safeErrorMessage(lastError)}`,
  }
}

export async function putRefreshStatus(kv: KVNamespace, status: RefreshStatus): Promise<void> {
  await patchRefreshRuntimeState(kv, { refreshStatus: status })
}
