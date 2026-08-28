import { KV_KEYS } from './kv-keys'
import { parseProviderConfigDocument, type ProviderConfigDocument } from '@/domain/provider'

export async function getProviderConfig(kv: KVNamespace): Promise<ProviderConfigDocument> {
  const value = await kv.get(KV_KEYS.providersConfig)
  if (!value) {
    throw new Error('Missing providers-config in KV')
  }
  return parseProviderConfigDocument(JSON.parse(value))
}

export async function putProviderConfig(kv: KVNamespace, config: ProviderConfigDocument): Promise<void> {
  await kv.put(KV_KEYS.providersConfig, JSON.stringify(config))
}
