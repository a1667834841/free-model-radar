import type { EvaluationMethod, EvaluationMetrics, FlattenedModel, RankedModel } from './types'
import { resolveStreamingMetrics } from './types'

export const RRF_K = 60
const RRF_METRIC_WEIGHTS = [1, 2, 1] as const
const HIGH_TPS_THRESHOLD = 300
const HIGH_TPS_WEIGHT = 0.5

/**
 * Calculate a Reciprocal Rank Fusion score from one or more metric ranks.
 * Each rank contributes weight / (k + rank), and higher is better.
 */
export function computeRrfScore(
  ranks: readonly number[],
  weights?: readonly number[],
  k = RRF_K,
): number {
  return ranks.reduce((score, rank, index) => {
    const weight = weights?.[index] ?? 1
    return score + weight / (k + rank)
  }, 0)
}

/** Normalize a weighted RRF score to the 0–100 range used by the dashboard. */
export function normalizeRrfScore(
  score: number,
  weights: readonly number[] = RRF_METRIC_WEIGHTS,
  k = RRF_K,
): number {
  const maximum = weights.reduce((sum, weight) => sum + weight / (k + 1), 0)
  return maximum > 0 ? (score / maximum) * 100 : 0
}

function compareByScoreDesc(a: EvaluationMetrics, b: EvaluationMetrics): number {
  const scoreA = a.score ?? -Infinity
  const scoreB = b.score ?? -Infinity
  if (scoreA !== scoreB) return scoreB - scoreA
  return 0
}

function tieBreakModels(a: FlattenedModel, b: FlattenedModel): number {
  const providerCompare = a.providerName.localeCompare(b.providerName)
  if (providerCompare !== 0) return providerCompare
  return a.id.localeCompare(b.id)
}

function modelKey(model: FlattenedModel): string {
  return `${model.providerId}:${model.id}`
}

function rankByMetric(
  models: FlattenedModel[],
  getValue: (model: FlattenedModel) => number | null,
  lowerIsBetter: boolean,
): Map<string, number> {
  const eligible = models.filter((model) => {
    const value = getValue(model)
    return value != null && Number.isFinite(value)
  })

  eligible.sort((a, b) => {
    const valueA = getValue(a) as number
    const valueB = getValue(b) as number
    if (valueA !== valueB) return lowerIsBetter ? valueA - valueB : valueB - valueA
    return tieBreakModels(a, b)
  })

  return new Map(eligible.map((model, index) => [modelKey(model), index + 1]))
}

function getTpsRrfWeight(tokensPerSec: number): number {
  // Keep measured throughput influential, but prevent unusually high values
  // from dominating the fused score when the sample is not representative.
  return tokensPerSec > HIGH_TPS_THRESHOLD ? HIGH_TPS_WEIGHT : RRF_METRIC_WEIGHTS[1]
}

function computeStreamingRrfScores(models: FlattenedModel[]): Map<string, number> {
  const ttftRanks = rankByMetric(models, (model) => resolveStreamingMetrics(model).ttftMs, true)
  const tpsRanks = rankByMetric(models, (model) => {
    const { tokensPerSec, tpsQuality } = resolveStreamingMetrics(model)
    return tpsQuality === 'estimated' ? null : tokensPerSec
  }, false)
  const e2eRanks = rankByMetric(models, (model) => model.latencyMs, true)

  return new Map(models.map((model) => {
    const key = modelKey(model)
    const { tokensPerSec, tpsQuality } = resolveStreamingMetrics(model)
    const ranks: number[] = []
    const weights: number[] = []

    const ttftRank = ttftRanks.get(key)
    if (ttftRank != null) {
      ranks.push(ttftRank)
      weights.push(RRF_METRIC_WEIGHTS[0])
    }

    const tpsRank = tpsRanks.get(key)
    if (tpsRank != null && tokensPerSec != null && tpsQuality !== 'estimated') {
      ranks.push(tpsRank)
      weights.push(getTpsRrfWeight(tokensPerSec))
    }

    const e2eRank = e2eRanks.get(key)
    if (e2eRank != null) {
      ranks.push(e2eRank)
      weights.push(RRF_METRIC_WEIGHTS[2])
    }

    return [key, normalizeRrfScore(computeRrfScore(ranks, weights))]
  }))
}

function assignRanks(
  models: FlattenedModel[],
  evaluate: (model: FlattenedModel) => EvaluationMetrics,
  compare: (a: FlattenedModel & EvaluationMetrics, b: FlattenedModel & EvaluationMetrics) => number,
): RankedModel[] {
  const evaluated = models.map((model) => ({ ...model, ...evaluate(model) }))
  evaluated.sort((a, b) => {
    const primary = compare(a, b)
    if (primary !== 0) return primary
    return tieBreakModels(a, b)
  })
  return evaluated.map((model, index) => ({
    ...model,
    rank: index + 1,
    groupRank: index + 1,
  }))
}

const streamingPerformance: EvaluationMethod = {
  id: 'streaming-performance',
  labelKey: 'eval.method.streaming',
  descriptionKey: 'eval.method.streaming.desc',
  noteKey: 'eval.note.singleThread',
  evaluate(model) {
    const { ttftMs, tokensPerSec, tpsQuality } = resolveStreamingMetrics(model)
    return { ttftMs, tokensPerSec, tpsQuality, score: null }
  },
  rank(models) {
    const scoreByModel = computeStreamingRrfScores(models)
    const evaluated = models.map((model) => ({
      ...model,
      ...this.evaluate(model),
      score: scoreByModel.get(modelKey(model)) ?? 0,
    }))

    evaluated.sort((a, b) => {
      const scoreCompare = compareByScoreDesc(a, b)
      if (scoreCompare !== 0) return scoreCompare
      const ttftA = a.ttftMs ?? Infinity
      const ttftB = b.ttftMs ?? Infinity
      if (ttftA !== ttftB) return ttftA - ttftB
      const tpsA = a.tokensPerSec ?? -Infinity
      const tpsB = b.tokensPerSec ?? -Infinity
      const tpsCompare = tpsB - tpsA
      if (tpsCompare !== 0) return tpsCompare
      return tieBreakModels(a, b)
    })

    return evaluated.map((model, index) => ({
      ...model,
      rank: index + 1,
      groupRank: index + 1,
    }))
  },
}

const latencyOnly: EvaluationMethod = {
  id: 'latency',
  labelKey: 'eval.method.latency',
  descriptionKey: 'eval.method.latency.desc',
  evaluate(model) {
    const { ttftMs, tokensPerSec, tpsQuality } = resolveStreamingMetrics(model)
    return { ttftMs, tokensPerSec, tpsQuality, score: null }
  },
  rank(models) {
    return assignRanks(models, this.evaluate.bind(this), (a, b) => {
      if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
      return 0
    })
  },
}

const METHODS: EvaluationMethod[] = [streamingPerformance, latencyOnly]

export const DEFAULT_EVALUATION_METHOD_ID = streamingPerformance.id

export function getEvaluationMethod(id: string): EvaluationMethod {
  return METHODS.find((method) => method.id === id) ?? streamingPerformance
}

export function listEvaluationMethods(): EvaluationMethod[] {
  return [...METHODS]
}
