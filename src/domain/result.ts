export type FreeStatus = 'free' | 'available'
export type ProviderStatus = 'healthy' | 'empty' | 'unavailable'

export type TokenUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export type ModelResult = {
  id: string
  latencyMs: number
  /** Time to first token from streaming probe; falls back to latencyMs for legacy snapshots */
  ttftMs?: number | null
  /** Completion throughput (tokens / second) after first token */
  tokensPerSec?: number | null
  availability: 'available'
  freeStatus: FreeStatus
  prompt: string
  content: string | null
  tokenUsage: TokenUsage
  checkedAt: string
}

export type ProviderResult = {
  id: string
  name: string
  baseUrl?: string
  status: ProviderStatus
  models: ModelResult[]
}

export type ResultsSnapshot = {
  updatedAt: string
  refreshId: string
  providers: ProviderResult[]
}

export type PublicResultsResponse = ResultsSnapshot & {
  isStale: boolean
}

export function sortModelsByLatency(models: ModelResult[]): ModelResult[] {
  return [...models].sort((a, b) => {
    if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
    return a.id.localeCompare(b.id)
  })
}

export function flattenProviderResults(providers: ProviderResult[]): Array<ModelResult & { providerId: string; providerName: string }> {
  return providers.flatMap((provider) => provider.models.map((model) => ({
    ...model,
    providerId: provider.id,
    providerName: provider.name,
  })))
}

/** @deprecated Use flattenProviderResults + evaluation method ranking instead */
export function flattenAndSortProviderResults(providers: ProviderResult[]): Array<ModelResult & { providerId: string; providerName: string }> {
  return flattenProviderResults(providers).sort((a, b) => {
    if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
    const providerCompare = a.providerName.localeCompare(b.providerName)
    if (providerCompare !== 0) return providerCompare
    return a.id.localeCompare(b.id)
  })
}
