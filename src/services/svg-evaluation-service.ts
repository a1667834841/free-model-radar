import type { RadarEnv } from '@/domain/env'
import type { ProviderConfig } from '@/domain/provider'
import {
  SVG_EVALUATION_BATCH_SIZE,
  SVG_EVALUATION_PROMPT,
  SVG_EVALUATION_PROMPT_VERSION,
  type SvgEvaluationPublicResponse,
  type SvgEvaluationQueueMessage,
  type SvgEvaluationStatus,
} from '@/domain/svg-evaluation'
import { getRadarDatabase, getSecret } from '@/domain/env'
import { getProviderConfig } from '@/storage/provider-config-store'
import { getLatestResults } from '@/storage/results-store'
import { safeErrorMessage } from '@/lib/json'
import { generateSvg } from './svg-generator'
import { sanitizeSvgResponse } from './svg-sanitizer'

type CandidateRow = {
  id: number
  provider_id: string
  model_id: string
  status: SvgEvaluationStatus
}

type EvaluationRow = CandidateRow & {
  prompt_version: number
  provider_name: string
  attempt_count: number
}

const MAX_INVALID_SVG_ATTEMPTS = 3
const RETRY_DELAY_SECONDS = 60 * 60
const STALE_TASK_SECONDS = 15 * 60
const CANDIDATE_INSERT_BATCH_SIZE = 16

type CandidateInsert = {
  providerId: string
  providerName: string
  modelId: string
}

type CandidateInsertStatement = {
  sql: string
  params: Array<string | number>
}

function nowIso(): string {
  return new Date().toISOString()
}

function classifyFailure(httpStatus: number | null): { status: SvgEvaluationStatus; errorCode: string; retry: boolean } {
  if (httpStatus === 401 || httpStatus === 403) return { status: 'auth_blocked', errorCode: 'auth_blocked', retry: false }
  if (httpStatus === 400 || httpStatus === 404 || httpStatus === 422) return { status: 'unsupported', errorCode: 'unsupported', retry: false }
  if (httpStatus === 408 || httpStatus === 429 || (httpStatus != null && httpStatus >= 500)) {
    return { status: 'retryable', errorCode: `http_${httpStatus}`, retry: true }
  }
  return { status: 'retryable', errorCode: httpStatus == null ? 'network_or_timeout' : `http_${httpStatus}`, retry: true }
}

function buildCandidateInsertStatements(candidates: CandidateInsert[], timestamp: string): CandidateInsertStatement[] {
  const statements: CandidateInsertStatement[] = []
  for (let index = 0; index < candidates.length; index += CANDIDATE_INSERT_BATCH_SIZE) {
    const batch = candidates.slice(index, index + CANDIDATE_INSERT_BATCH_SIZE)
    const values = batch.map(() => "(?, ?, ?, ?, 'pending', ?, ?)").join(', ')
    statements.push({
      sql: `
        INSERT INTO svg_evaluations (
          prompt_version, provider_id, provider_name, model_id, status, created_at, updated_at
        ) VALUES ${values}
        ON CONFLICT(prompt_version, provider_id, model_id)
        DO UPDATE SET provider_name = excluded.provider_name, updated_at = excluded.updated_at
        WHERE svg_evaluations.provider_name <> excluded.provider_name
      `,
      params: batch.flatMap((candidate) => [
        SVG_EVALUATION_PROMPT_VERSION,
        candidate.providerId,
        candidate.providerName,
        candidate.modelId,
        timestamp,
        timestamp,
      ]),
    })
  }
  return statements
}

async function syncCandidates(env: RadarEnv): Promise<Set<string>> {
  const db = getRadarDatabase(env)
  const snapshot = await getLatestResults(env.RADAR_KV)
  const current = new Set<string>()
  if (!snapshot) return current
  const timestamp = nowIso()
  const candidates: CandidateInsert[] = []
  for (const provider of snapshot.providers) {
    for (const model of provider.models) {
      current.add(`${provider.id}\0${model.id}`)
      candidates.push({ providerId: provider.id, providerName: provider.name, modelId: model.id })
    }
  }
  for (const statement of buildCandidateInsertStatements(candidates, timestamp)) {
    await db.prepare(statement.sql).bind(...statement.params).run()
  }
  return current
}

function selectFairCandidates(rows: CandidateRow[], current: Set<string>): CandidateRow[] {
  const providerCounts = new Map<string, number>()
  const selected: CandidateRow[] = []
  for (const row of rows) {
    if (!current.has(`${row.provider_id}\0${row.model_id}`)) continue
    const count = providerCounts.get(row.provider_id) ?? 0
    if (count >= 2) continue
    selected.push(row)
    providerCounts.set(row.provider_id, count + 1)
    if (selected.length >= SVG_EVALUATION_BATCH_SIZE) break
  }
  return selected
}

export async function scheduleSvgEvaluations(env: RadarEnv, queue: Queue<SvgEvaluationQueueMessage>): Promise<number> {
  const db = getRadarDatabase(env)
  const current = await syncCandidates(env)
  if (current.size === 0) return 0
  const timestamp = nowIso()
  const staleBefore = new Date(Date.now() - STALE_TASK_SECONDS * 1000).toISOString()
  await db.prepare(`
    UPDATE svg_evaluations SET status = 'retryable', error_code = 'stale_task',
      error_message = '队列任务超时，已回收等待重试', next_attempt_at = ?, updated_at = ?
    WHERE prompt_version = ? AND status IN ('queued', 'running') AND updated_at < ?
  `).bind(timestamp, timestamp, SVG_EVALUATION_PROMPT_VERSION, staleBefore).run()
  const result = await db.prepare(`
    SELECT id, provider_id, model_id, status
    FROM svg_evaluations
    WHERE prompt_version = ?
      AND (status = 'pending' OR (status = 'retryable' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)))
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, updated_at ASC
    LIMIT 200
  `).bind(SVG_EVALUATION_PROMPT_VERSION, timestamp).all<CandidateRow>()
  const selected = selectFairCandidates(result.results, current)
  let enqueued = 0
  for (const row of selected) {
    const claim = await db.prepare(`
      UPDATE svg_evaluations SET status = 'queued', updated_at = ?
      WHERE id = ? AND (status = 'pending' OR (status = 'retryable' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)))
    `).bind(timestamp, row.id, timestamp).run()
    if (!claim.meta.changes) continue
    try {
      await queue.send({
        evaluationId: row.id,
        promptVersion: SVG_EVALUATION_PROMPT_VERSION,
        providerId: row.provider_id,
        modelId: row.model_id,
      })
      enqueued += 1
    } catch (error) {
      await db.prepare(`
        UPDATE svg_evaluations SET status = 'retryable', error_code = 'queue_send_failed',
          error_message = ?, next_attempt_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'
      `).bind(safeErrorMessage(error), timestamp, timestamp, row.id).run()
    }
  }
  return enqueued
}

async function loadEvaluation(db: D1Database, id: number): Promise<EvaluationRow | null> {
  return db.prepare(`
    SELECT id, prompt_version, provider_id, provider_name, model_id, status, attempt_count
    FROM svg_evaluations WHERE id = ?
  `).bind(id).first<EvaluationRow>()
}

function findProvider(providers: ProviderConfig[], id: string): ProviderConfig | null {
  return providers.find((provider) => provider.id === id && provider.enabled) ?? null
}

export async function processSvgEvaluationMessage(
  env: RadarEnv,
  message: SvgEvaluationQueueMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const db = getRadarDatabase(env)
  const row = await loadEvaluation(db, message.evaluationId)
  if (!row || row.prompt_version !== message.promptVersion || row.provider_id !== message.providerId || row.model_id !== message.modelId) return
  if (row.status !== 'queued' && row.status !== 'running') return

  const startedAt = nowIso()
  await db.prepare(`
    UPDATE svg_evaluations SET status = 'running', attempt_count = attempt_count + 1,
      started_at = ?, updated_at = ? WHERE id = ?
  `).bind(startedAt, startedAt, row.id).run()

  const config = await getProviderConfig(env.RADAR_KV)
  const provider = findProvider(config.providers, row.provider_id)
  if (!provider) {
    await db.prepare(`
      UPDATE svg_evaluations SET status = 'unsupported', error_code = 'provider_disabled',
        error_message = '厂商已停用或不存在', updated_at = ? WHERE id = ?
    `).bind(nowIso(), row.id).run()
    return
  }

  let apiKey: string
  try {
    apiKey = getSecret(env, provider.secretName)
  } catch (error) {
    await markProviderAuthBlocked(db, row, safeErrorMessage(error), null)
    return
  }

  const generated = await generateSvg(provider, apiKey, row.model_id, fetchImpl)
  if (!generated.ok) {
    const failure = classifyFailure(generated.httpStatus)
    if (failure.status === 'auth_blocked') {
      await markProviderAuthBlocked(db, row, generated.error, generated.httpStatus)
      return
    }
    const nextAttemptAt = failure.retry ? new Date(Date.now() + RETRY_DELAY_SECONDS * 1000).toISOString() : null
    await db.prepare(`
      UPDATE svg_evaluations SET status = ?, raw_response = ?, http_status = ?, error_code = ?,
        error_message = ?, duration_ms = ?, prompt_tokens = ?, completion_tokens = ?,
        next_attempt_at = ?, updated_at = ? WHERE id = ?
    `).bind(failure.status, generated.rawResponse, generated.httpStatus, failure.errorCode,
      generated.error, generated.durationMs, generated.promptTokens, generated.completionTokens,
      nextAttemptAt, nowIso(), row.id).run()
    return
  }

  let sanitizedSvg: string
  try {
    sanitizedSvg = sanitizeSvgResponse(generated.rawResponse)
  } catch (error) {
    const attemptCount = row.attempt_count + 1
    const shouldRetry = attemptCount < MAX_INVALID_SVG_ATTEMPTS
    await db.prepare(`
      UPDATE svg_evaluations SET status = 'invalid_svg', raw_response = ?, error_code = 'invalid_svg',
        error_message = ?, duration_ms = ?, prompt_tokens = ?, completion_tokens = ?,
        next_attempt_at = ?, updated_at = ? WHERE id = ?
    `).bind(generated.rawResponse, safeErrorMessage(error), generated.durationMs, generated.promptTokens,
      generated.completionTokens, shouldRetry ? new Date(Date.now() + RETRY_DELAY_SECONDS * 1000).toISOString() : null,
      nowIso(), row.id).run()
    // 前两次无效 SVG 仍转回可重试队列；第三次保留 invalid_svg 停止调度。
    if (shouldRetry) {
      await db.prepare(`UPDATE svg_evaluations SET status = 'retryable' WHERE id = ? AND status = 'invalid_svg'`).bind(row.id).run()
    }
    return
  }

  const completedAt = nowIso()
  await db.prepare(`
    UPDATE svg_evaluations SET status = 'success', sanitized_svg = ?, raw_response = ?,
      http_status = 200, error_code = NULL, error_message = NULL, duration_ms = ?,
      prompt_tokens = ?, completion_tokens = ?, next_attempt_at = NULL,
      completed_at = ?, updated_at = ? WHERE id = ?
  `).bind(sanitizedSvg, generated.rawResponse, generated.durationMs, generated.promptTokens,
    generated.completionTokens, completedAt, completedAt, row.id).run()
}

async function markProviderAuthBlocked(db: D1Database, row: EvaluationRow, error: string, httpStatus: number | null): Promise<void> {
  const timestamp = nowIso()
  await db.batch([
    db.prepare(`
      UPDATE svg_evaluations SET status = 'auth_blocked', http_status = ?, error_code = 'auth_blocked',
        error_message = ?, next_attempt_at = NULL, updated_at = ? WHERE id = ?
    `).bind(httpStatus, error, timestamp, row.id),
    db.prepare(`
      UPDATE svg_evaluations SET status = 'auth_blocked', error_code = 'provider_auth_blocked',
        error_message = ?, next_attempt_at = NULL, updated_at = ?
      WHERE prompt_version = ? AND provider_id = ? AND id != ? AND status IN ('pending', 'retryable', 'queued')
    `).bind(error, timestamp, row.prompt_version, row.provider_id, row.id),
  ])
}

export async function getPublicSvgEvaluations(db: D1Database): Promise<SvgEvaluationPublicResponse> {
  const result = await db.prepare(`
    WITH ranked AS (
      SELECT id, provider_id, provider_name, model_id, duration_ms, prompt_tokens, completion_tokens, completed_at,
        ROW_NUMBER() OVER (
          PARTITION BY provider_id, model_id
          ORDER BY prompt_version DESC, completed_at DESC, id DESC
        ) AS row_number
      FROM svg_evaluations
      WHERE status = 'success' AND sanitized_svg IS NOT NULL
    )
    SELECT id, provider_id, provider_name, model_id, duration_ms, prompt_tokens, completion_tokens, completed_at
    FROM ranked
    WHERE row_number = 1
    ORDER BY completed_at DESC, id DESC
  `).all<{
    id: number
    provider_id: string
    provider_name: string
    model_id: string
    duration_ms: number | null
    prompt_tokens: number | null
    completion_tokens: number | null
    completed_at: string
  }>()
  return {
    prompt: SVG_EVALUATION_PROMPT,
    promptVersion: SVG_EVALUATION_PROMPT_VERSION,
    items: result.results.map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      providerName: row.provider_name,
      modelId: row.model_id,
      durationMs: row.duration_ms,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      completedAt: row.completed_at,
      imageUrl: `/api/svg-evaluations/${row.id}/image`,
    })),
  }
}

export async function getPublicSvgImage(db: D1Database, id: number): Promise<string | null> {
  const row = await db.prepare(`
    SELECT sanitized_svg FROM svg_evaluations
    WHERE id = ? AND status = 'success' AND sanitized_svg IS NOT NULL
  `).bind(id).first<{ sanitized_svg: string }>()
  return row?.sanitized_svg ?? null
}

export const svgEvaluationInternals = {
  classifyFailure,
  selectFairCandidates,
  buildCandidateInsertStatements,
  CANDIDATE_INSERT_BATCH_SIZE,
  MAX_INVALID_SVG_ATTEMPTS,
}
