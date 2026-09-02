/** 综合分颜色档位（单一事实源）。分数已由评测逻辑归一化到 0–100。 */
export const SCORE_TIER = [
  { min: 85, cssVar: 'var(--lat-fast)', label: 'high' },
  { min: 70, cssVar: 'var(--lat-mid)', label: 'mid' },
  { min: -Infinity, cssVar: 'var(--lat-slow)', label: 'low' },
] as const

export type ScoreTier = (typeof SCORE_TIER)[number]

export function scoreTierOf(score: number): ScoreTier {
  for (const tier of SCORE_TIER) {
    if (score >= tier.min) return tier
  }
  return SCORE_TIER[SCORE_TIER.length - 1]
}

export function getScoreTierVar(score: number | null): string {
  return score == null ? 'var(--track)' : scoreTierOf(score).cssVar
}
