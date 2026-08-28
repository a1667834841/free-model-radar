import { KV_KEYS } from './kv-keys'
import type { ModelHealthState } from '@/services/model-health-service'

export async function getModelHealthState(kv: KVNamespace): Promise<ModelHealthState> {
  const value = await kv.get(KV_KEYS.modelHealthState)
  return value ? JSON.parse(value) as ModelHealthState : {}
}

export async function putModelHealthState(kv: KVNamespace, state: ModelHealthState): Promise<void> {
  await kv.put(KV_KEYS.modelHealthState, JSON.stringify(state))
}
