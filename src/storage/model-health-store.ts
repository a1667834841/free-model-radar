import type { ModelHealthState } from '@/services/model-health-service'
import { getRefreshRuntimeState, patchRefreshRuntimeState } from './refresh-runtime-store'

export async function getModelHealthState(kv: KVNamespace): Promise<ModelHealthState> {
  return (await getRefreshRuntimeState(kv)).modelHealthState
}

export async function putModelHealthState(kv: KVNamespace, state: ModelHealthState): Promise<void> {
  await patchRefreshRuntimeState(kv, { modelHealthState: state })
}
