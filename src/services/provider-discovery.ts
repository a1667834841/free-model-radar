import type { ProviderConfig } from '@/domain/provider'
import type { DiscoveredModel } from '@/domain/model'
import { readJsonResponse } from '@/lib/json'
import { withTimeout } from '@/lib/timeout'

function parseModelsPayload(payload: unknown): DiscoveredModel[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []

  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const id = (item as { id?: unknown }).id
      return typeof id === 'string' && id.trim() ? { id } : null
    })
    .filter((model): model is DiscoveredModel => model !== null)
}

export async function discoverModels(provider: ProviderConfig, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<DiscoveredModel[]> {
  const startedAt = Date.now()
  const url = new URL(provider.baseUrl.replace(/\/$/, '') + '/models')

  const response = await withTimeout(
    (signal) => fetchImpl(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      signal,
    }),
    provider.probe.timeoutMs,
  )

  if (response.status !== 200) {
    console.log(`[discover:${provider.id}] HTTP ${response.status} after ${Date.now() - startedAt}ms`)
    throw new Error(`Models request failed with HTTP ${response.status}`)
  }

  const payload = await readJsonResponse(response)
  return parseModelsPayload(payload)
}

export const modelDiscoveryInternals = {
  parseModelsPayload,
}
