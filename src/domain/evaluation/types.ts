import type { ModelResult } from '@/domain/result'

export type FlattenedModel = ModelResult & {
  providerId: string
  providerName: string
}

export type EvaluationMetrics = {
  ttftMs: number | null
  tokensPerSec: number | null
  score: number | null
}

export type RankedModel = FlattenedModel & EvaluationMetrics & {
  rank: number
  groupRank: number
}

export type EvaluationMethodId = 'streaming-performance' | 'latency'

export type EvaluationMethod = {
  id: EvaluationMethodId
  /** i18n key for the method label */
  labelKey: 'eval.method.streaming' | 'eval.method.latency'
  /** i18n key for short description shown in selector */
  descriptionKey: 'eval.method.streaming.desc' | 'eval.method.latency.desc'
  /** i18n key for footnote (e.g. single-threaded disclaimer) */
  noteKey?: 'eval.note.singleThread'
  /** Compute derived metrics and composite score for one model */
  evaluate: (model: FlattenedModel) => EvaluationMetrics
  /** Sort models best-first; assigns rank starting at 1 */
  rank: (models: FlattenedModel[]) => RankedModel[]
}

export type EvaluationColumn = {
  id: 'ttft' | 'tps' | 'latency' | 'score'
  labelKey: string
  format: (model: RankedModel, locale: 'zh' | 'en') => string
}

export function resolveStreamingMetrics(model: FlattenedModel): { ttftMs: number; tokensPerSec: number | null } {
  const ttftMs = model.ttftMs ?? model.latencyMs
  if (model.tokensPerSec != null) {
    return { ttftMs, tokensPerSec: model.tokensPerSec }
  }
  const completionTokens = model.tokenUsage.completionTokens
  if (completionTokens == null) return { ttftMs, tokensPerSec: null }
  // Legacy snapshots lack separate TTFT — approximate throughput over total latency.
  const durationMs = model.ttftMs != null
    ? Math.max(model.latencyMs - ttftMs, 1)
    : model.latencyMs
  return { ttftMs, tokensPerSec: completionTokens / (durationMs / 1000) }
}

export function estimateTokensFromContent(content: string | null): number | null {
  if (!content || content.trim().length === 0) return null
  return Math.max(1, Math.ceil(content.trim().length / 4))
}
