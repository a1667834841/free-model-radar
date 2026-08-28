export type ModelHealthRecord = {
  providerId: string
  modelId: string
  consecutiveFailures: number
  hidden: boolean
  hiddenReason: 'five-consecutive-failures' | null
  lastCheckedAt: string | null
}

export type ModelHealthState = Record<string, ModelHealthRecord>

export function modelHealthKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`
}

export function isModelHidden(state: ModelHealthState, providerId: string, modelId: string): boolean {
  return state[modelHealthKey(providerId, modelId)]?.hidden === true
}

export function recordModelSuccess(state: ModelHealthState, providerId: string, modelId: string, checkedAt: string): ModelHealthState {
  return {
    ...state,
    [modelHealthKey(providerId, modelId)]: {
      providerId,
      modelId,
      consecutiveFailures: 0,
      hidden: false,
      hiddenReason: null,
      lastCheckedAt: checkedAt,
    },
  }
}

export function recordModelFailure(state: ModelHealthState, providerId: string, modelId: string, checkedAt: string): ModelHealthState {
  const key = modelHealthKey(providerId, modelId)
  const previous = state[key]
  const consecutiveFailures = (previous?.consecutiveFailures ?? 0) + 1
  return {
    ...state,
    [key]: {
      providerId,
      modelId,
      consecutiveFailures,
      hidden: consecutiveFailures >= 5,
      hiddenReason: consecutiveFailures >= 5 ? 'five-consecutive-failures' : null,
      lastCheckedAt: checkedAt,
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
      hidden: false,
      hiddenReason: null,
      lastCheckedAt: new Date().toISOString(),
    },
  }
}
