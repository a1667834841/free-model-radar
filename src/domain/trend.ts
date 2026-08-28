export type TrendMetricKey = 'ttftMs' | 'tokensPerSec' | 'latencyMs'

export type TrendSampleStatus = 'ok' | 'failed' | 'unavailable' | 'missing'

export type TrendSample = {
  providerId: string
  providerName: string
  modelId: string
  checkedAt: string
  status: TrendSampleStatus
  ttftMs: number | null
  tokensPerSec: number | null
  latencyMs: number | null
}

export type DailyTrendBucket = {
  version: 1
  date: string
  samples: TrendSample[]
}

export type TrendMetricStats = {
  ttftMs: number | null
  tokensPerSec: number | null
  latencyMs: number | null
}

export type ModelTrendStats = {
  providerId: string
  providerName: string
  modelId: string
  sampleCount: number
  successCount: number
  successRate: number
  lastCheckedAt: string | null
  current: TrendMetricStats
  avg: TrendMetricStats
  median: TrendMetricStats
  p95: TrendMetricStats
}

export type ProviderTrendStats = {
  providerId: string
  providerName: string
  modelCount: number
  sampleCount: number
  successCount: number
  successRate: number
  avg: TrendMetricStats
  median: TrendMetricStats
  p95: TrendMetricStats
}

export type ProviderTrendGroup = {
  providerId: string
  providerName: string
  stats: ProviderTrendStats
  models: ModelTrendStats[]
}

export type TrendResponse = {
  rangeDays: number
  generatedAt: string
  bucketDates: string[]
  samples: TrendSample[]
  modelStats: ModelTrendStats[]
  providerStats: ProviderTrendStats[]
  providers: ProviderTrendGroup[]
}

const METRICS: TrendMetricKey[] = ['ttftMs', 'tokensPerSec', 'latencyMs']

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(sortedValues: number[], percentileValue: number): number | null {
  if (sortedValues.length === 0) return null
  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1
  return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)]
}

function median(sortedValues: number[]): number | null {
  if (sortedValues.length === 0) return null
  const middle = Math.floor(sortedValues.length / 2)
  if (sortedValues.length % 2 === 1) return sortedValues[middle]
  return (sortedValues[middle - 1] + sortedValues[middle]) / 2
}

function collectMetricStats(samples: TrendSample[], metric: TrendMetricKey): {
  avg: number | null
  median: number | null
  p95: number | null
} {
  const values = samples
    .map((sample) => sample[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b)

  return {
    avg: mean(values),
    median: median(values),
    p95: percentile(values, 95),
  }
}

function emptyMetricStats(): TrendMetricStats {
  return { ttftMs: null, tokensPerSec: null, latencyMs: null }
}

function summarizeMetrics(samples: TrendSample[]): {
  avg: TrendMetricStats
  median: TrendMetricStats
  p95: TrendMetricStats
} {
  const avg = emptyMetricStats()
  const medianStats = emptyMetricStats()
  const p95 = emptyMetricStats()

  for (const metric of METRICS) {
    const stats = collectMetricStats(samples, metric)
    avg[metric] = stats.avg
    medianStats[metric] = stats.median
    p95[metric] = stats.p95
  }

  return { avg, median: medianStats, p95 }
}

function latestSuccessfulSample(samples: TrendSample[]): TrendSample | null {
  const successful = samples
    .filter((sample) => sample.status === 'ok')
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
  return successful[0] ?? null
}

function modelKey(sample: Pick<TrendSample, 'providerId' | 'modelId'>): string {
  return `${sample.providerId}:${sample.modelId}`
}

function providerKey(sample: Pick<TrendSample, 'providerId'>): string {
  return sample.providerId
}

export function createTrendResponse(samples: TrendSample[], rangeDays: number, generatedAt = new Date().toISOString()): TrendResponse {
  const sortedSamples = [...samples].sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
  const byModel = new Map<string, TrendSample[]>()
  const byProvider = new Map<string, TrendSample[]>()

  for (const sample of sortedSamples) {
    const key = modelKey(sample)
    byModel.set(key, [...(byModel.get(key) ?? []), sample])
    const pKey = providerKey(sample)
    byProvider.set(pKey, [...(byProvider.get(pKey) ?? []), sample])
  }

  const modelStats = Array.from(byModel.values())
    .map((group): ModelTrendStats => {
      const first = group[0]
      const successCount = group.filter((sample) => sample.status === 'ok').length
      const latest = latestSuccessfulSample(group)
      const metricStats = summarizeMetrics(group)
      return {
        providerId: first.providerId,
        providerName: first.providerName,
        modelId: first.modelId,
        sampleCount: group.length,
        successCount,
        successRate: group.length === 0 ? 0 : successCount / group.length,
        lastCheckedAt: group[group.length - 1]?.checkedAt ?? null,
        current: latest
          ? { ttftMs: latest.ttftMs, tokensPerSec: latest.tokensPerSec, latencyMs: latest.latencyMs }
          : emptyMetricStats(),
        ...metricStats,
      }
    })
    .sort((a, b) => {
      const medianA = a.median.ttftMs ?? Infinity
      const medianB = b.median.ttftMs ?? Infinity
      if (medianA !== medianB) return medianA - medianB
      if (a.successRate !== b.successRate) return b.successRate - a.successRate
      return a.modelId.localeCompare(b.modelId)
    })

  const providerStats = Array.from(byProvider.values())
    .map((group): ProviderTrendStats => {
      const first = group[0]
      const successCount = group.filter((sample) => sample.status === 'ok').length
      const modelCount = new Set(group.map(modelKey)).size
      const metricStats = summarizeMetrics(group)
      return {
        providerId: first.providerId,
        providerName: first.providerName,
        modelCount,
        sampleCount: group.length,
        successCount,
        successRate: group.length === 0 ? 0 : successCount / group.length,
        ...metricStats,
      }
    })
    .sort((a, b) => {
      const medianA = a.median.ttftMs ?? Infinity
      const medianB = b.median.ttftMs ?? Infinity
      if (medianA !== medianB) return medianA - medianB
      return a.providerName.localeCompare(b.providerName)
    })

  const modelStatsByProvider = new Map<string, ModelTrendStats[]>()
  for (const stats of modelStats) {
    modelStatsByProvider.set(stats.providerId, [...(modelStatsByProvider.get(stats.providerId) ?? []), stats])
  }

  const providers = providerStats.map((stats) => ({
    providerId: stats.providerId,
    providerName: stats.providerName,
    stats,
    models: modelStatsByProvider.get(stats.providerId) ?? [],
  }))

  return {
    rangeDays,
    generatedAt,
    bucketDates: Array.from(new Set(sortedSamples.map((sample) => sample.checkedAt.slice(0, 10)))),
    samples: sortedSamples,
    modelStats,
    providerStats,
    providers,
  }
}
