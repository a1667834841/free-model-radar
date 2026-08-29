import type { EvaluationMethod, EvaluationMetrics, FlattenedModel, RankedModel } from './types'
import { resolveStreamingMetrics } from './types'

const SCORE_EPSILON_SEC = 0.1

/**
 * Composite score balancing throughput and responsiveness.
 * score = tokensPerSec / (ttftSec + ε)
 *
 * Higher is better: rewards fast generation and low time-to-first-token.
 */
export function computeStreamingScore(ttftMs: number, tokensPerSec: number): number {
  const ttftSec = ttftMs / 1000
  return tokensPerSec / (ttftSec + SCORE_EPSILON_SEC)
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
    const score = tokensPerSec != null && tpsQuality !== 'estimated' ? computeStreamingScore(ttftMs, tokensPerSec) : null
    return { ttftMs, tokensPerSec, tpsQuality, score }
  },
  rank(models) {
    return assignRanks(models, this.evaluate.bind(this), (a, b) => {
      const scoreCompare = compareByScoreDesc(a, b)
      if (scoreCompare !== 0) return scoreCompare
      const ttftA = a.ttftMs ?? Infinity
      const ttftB = b.ttftMs ?? Infinity
      if (ttftA !== ttftB) return ttftA - ttftB
      const tpsA = a.tokensPerSec ?? -Infinity
      const tpsB = b.tokensPerSec ?? -Infinity
      return tpsB - tpsA
    })
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
