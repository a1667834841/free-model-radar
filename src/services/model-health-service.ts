export type ModelHealthStatus = 'ok' | 'rate_limited' | 'transient_failure' | 'permanent_failure'

export type ModelHealthRecord = {
  providerId: string
  modelId: string
  /** @deprecated Use requestFailureCount. Kept for older KV records and UI compatibility. */
  consecutiveFailures: number
  /** Consecutive failed probe count. Reset to 0 after any successful response. */
  requestFailureCount: number
  hidden: boolean
  hiddenReason: 'thirty-consecutive-failures' | null
  lastCheckedAt: string | null
  /** Last probe classification. Older KV records may not have this field. */
  lastStatus?: ModelHealthStatus
}

export type ModelHealthState = Record<string, ModelHealthRecord>

const MAX_CONSECUTIVE_REQUEST_FAILURES = 30
const SUCCESS_RECHECK_INTERVAL_MS = 60 * 60 * 1000
const RATE_LIMIT_RECHECK_INTERVAL_MS = 2 * 60 * 1000
const TRANSIENT_FAILURE_RECHECK_INTERVAL_MS = 10 * 60 * 1000
const PERMANENT_FAILURE_RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

export function modelHealthKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`
}

export function isModelHidden(state: ModelHealthState, providerId: string, modelId: string): boolean {
  const record = state[modelHealthKey(providerId, modelId)]
  if (!record?.hidden) return false
  // 兼容线上旧记录：429/超时是暂时状态，不能永久隐藏模型。
  return record.lastStatus !== 'rate_limited' && record.lastStatus !== 'transient_failure'
}

function elapsedSince(checkedAt: string | null | undefined, now: Date): number | null {
  if (!checkedAt) return null
  const checkedAtMs = Date.parse(checkedAt)
  if (Number.isNaN(checkedAtMs)) return null
  return now.getTime() - checkedAtMs
}

export function isModelDueForProbe(state: ModelHealthState, providerId: string, modelId: string, now = new Date()): boolean {
  const record = state[modelHealthKey(providerId, modelId)]
  if (!record) return true
  if (record.hidden) return false

  const elapsedMs = elapsedSince(record.lastCheckedAt, now)
  if (elapsedMs == null) return true

  switch (record.lastStatus) {
    case 'ok':
    case undefined:
      return elapsedMs >= SUCCESS_RECHECK_INTERVAL_MS
    case 'rate_limited':
      return elapsedMs >= RATE_LIMIT_RECHECK_INTERVAL_MS
    case 'transient_failure':
      return elapsedMs >= TRANSIENT_FAILURE_RECHECK_INTERVAL_MS
    case 'permanent_failure':
      return elapsedMs >= PERMANENT_FAILURE_RECHECK_INTERVAL_MS
  }
}

export function classifyProbeFailure(error: string): ModelHealthStatus {
  const normalized = error.toLowerCase()
  if (normalized.includes('http 429')) return 'rate_limited'
  if (normalized.includes('timed out') || normalized.includes('aborted')) return 'transient_failure'
  if (normalized.includes('http 500') || normalized.includes('http 502') || normalized.includes('http 503') || normalized.includes('http 504')) return 'transient_failure'
  if (normalized.includes('does not contain valid assistant content')) return 'transient_failure'
  return 'permanent_failure'
}

export function recordModelSuccess(state: ModelHealthState, providerId: string, modelId: string, checkedAt: string): ModelHealthState {
  return {
    ...state,
    [modelHealthKey(providerId, modelId)]: {
      providerId,
      modelId,
      consecutiveFailures: 0,
      requestFailureCount: 0,
      hidden: false,
      hiddenReason: null,
      lastCheckedAt: checkedAt,
      lastStatus: 'ok',
    },
  }
}

export function recordModelFailure(state: ModelHealthState, providerId: string, modelId: string, checkedAt: string, status: ModelHealthStatus = 'permanent_failure'): ModelHealthState {
  const key = modelHealthKey(providerId, modelId)
  const previous = state[key]
  const previousFailureCount = previous?.requestFailureCount ?? previous?.consecutiveFailures ?? 0
  const requestFailureCount = previous?.lastStatus === status || previous?.lastStatus === undefined
    ? previousFailureCount + 1
    : 1
  const hidden = status === 'permanent_failure' && requestFailureCount >= MAX_CONSECUTIVE_REQUEST_FAILURES
  return {
    ...state,
    [key]: {
      providerId,
      modelId,
      consecutiveFailures: requestFailureCount,
      requestFailureCount,
      hidden,
      hiddenReason: hidden ? 'thirty-consecutive-failures' : null,
      lastCheckedAt: checkedAt,
      lastStatus: status,
    },
  }
}

export function restoreModel(state: ModelHealthState, providerId: string, modelId: string): ModelHealthState {
  return {
    ...state,
    [modelHealthKey(providerId, modelId)]: {
      providerId,
      modelId,
      consecutiveFailures: 0,
      requestFailureCount: 0,
      hidden: false,
      hiddenReason: null,
      lastCheckedAt: null,
      lastStatus: 'rate_limited',
    },
  }
}

export function restoreProvider(state: ModelHealthState, providerId: string): { state: ModelHealthState; restoredCount: number } {
  let restoredCount = 0
  const nextState: ModelHealthState = { ...state }

  for (const [key, record] of Object.entries(state)) {
    if (record.providerId !== providerId) continue
    restoredCount += 1
    nextState[key] = {
      ...record,
      consecutiveFailures: 0,
      requestFailureCount: 0,
      hidden: false,
      hiddenReason: null,
      lastCheckedAt: null,
      lastStatus: 'rate_limited',
    }
  }

  return { state: nextState, restoredCount }
}
