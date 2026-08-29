import type { RefreshJob, RefreshStatus } from '@/domain/refresh'
import type { ModelHealthState } from '@/services/model-health-service'
import { KV_KEYS } from './kv-keys'

export type RefreshRuntimeState = {
  refreshJob: RefreshJob | null
  refreshStatus: RefreshStatus | null
  modelHealthState: ModelHealthState
}

const EMPTY_RUNTIME_STATE: RefreshRuntimeState = {
  refreshJob: null,
  refreshStatus: null,
  modelHealthState: {},
}

async function readJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const value = await kv.get(key)
  return value ? JSON.parse(value) as T : null
}

async function getLegacyRuntimeState(kv: KVNamespace): Promise<RefreshRuntimeState> {
  const [refreshJob, refreshStatus, modelHealthState] = await Promise.all([
    readJson<RefreshJob>(kv, KV_KEYS.refreshJob),
    readJson<RefreshStatus>(kv, KV_KEYS.latestRefreshStatus),
    readJson<ModelHealthState>(kv, KV_KEYS.modelHealthState),
  ])

  return {
    refreshJob,
    refreshStatus,
    modelHealthState: modelHealthState ?? {},
  }
}

export async function getRefreshRuntimeState(kv: KVNamespace): Promise<RefreshRuntimeState> {
  const current = await readJson<RefreshRuntimeState>(kv, KV_KEYS.refreshRuntimeState)
  if (current) {
    return {
      refreshJob: current.refreshJob ?? null,
      refreshStatus: current.refreshStatus ?? null,
      modelHealthState: current.modelHealthState ?? {},
    }
  }
  return getLegacyRuntimeState(kv)
}

export async function putRefreshRuntimeState(kv: KVNamespace, state: RefreshRuntimeState): Promise<void> {
  await kv.put(KV_KEYS.refreshRuntimeState, JSON.stringify(state))
}

export async function patchRefreshRuntimeState(kv: KVNamespace, patch: Partial<RefreshRuntimeState>): Promise<RefreshRuntimeState> {
  const current = await getRefreshRuntimeState(kv)
  const next: RefreshRuntimeState = {
    refreshJob: patch.refreshJob === undefined ? current.refreshJob : patch.refreshJob,
    refreshStatus: patch.refreshStatus === undefined ? current.refreshStatus : patch.refreshStatus,
    modelHealthState: patch.modelHealthState === undefined ? current.modelHealthState : patch.modelHealthState,
  }
  await putRefreshRuntimeState(kv, next)
  return next
}
