import type { FlattenedModel } from './types'
import { resolveStreamingMetrics } from './types'

export type FastestTtftSummary = {
  id: string
  ttftMs: number
}

export type ModelBestEntry = {
  providerId: string
  id: string
  value: number
}

export type ModelBestSummary = {
  bestTtft: ModelBestEntry | null
  bestTps: ModelBestEntry | null
  bestE2e: ModelBestEntry | null
}

export function findFastestTtftModel(models: FlattenedModel[]): FastestTtftSummary | null {
  return models.reduce<FastestTtftSummary | null>((fastest, model) => {
    const ttftMs = resolveStreamingMetrics(model).ttftMs
    if (!fastest || ttftMs < fastest.ttftMs || (ttftMs === fastest.ttftMs && model.id.localeCompare(fastest.id) < 0)) {
      return { id: model.id, ttftMs }
    }
    return fastest
  }, null)
}

/**
 * 找出三个性能指标各自的“最优”模型：
 * - bestTtft：首字耗时最小
 * - bestTps：吞吐最大
 * - bestE2e：端到端耗时最小
 * 用 providerId:id 标识，避免不同厂商同名模型互相干扰。
 */
export function findModelBest(models: FlattenedModel[]): ModelBestSummary {
  let bestTtft: ModelBestEntry | null = null
  let bestTps: ModelBestEntry | null = null
  let bestE2e: ModelBestEntry | null = null

  for (const model of models) {
    const { ttftMs, tokensPerSec } = resolveStreamingMetrics(model)
    const key = { providerId: model.providerId, id: model.id }

    if (ttftMs != null && (!bestTtft || ttftMs < bestTtft.value)) {
      bestTtft = { ...key, value: ttftMs }
    }
    if (tokensPerSec != null && (!bestTps || tokensPerSec > bestTps.value)) {
      bestTps = { ...key, value: tokensPerSec }
    }
    if (model.latencyMs != null && (!bestE2e || model.latencyMs < bestE2e.value)) {
      bestE2e = { ...key, value: model.latencyMs }
    }
  }

  return { bestTtft, bestTps, bestE2e }
}
