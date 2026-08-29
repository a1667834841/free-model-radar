/**
 * TTFT 延迟档位（单一事实源）。
 * 阈值同时驱动：hex 色（内联渐变）、设计稿 pf-* 类、--lat-* CSS 变量。
 */

export const TTFT_TIER = [
  { max: 500, color: '#3FCF8E', cssVar: 'var(--lat-fast)', tierClass: 'pf-fast', label: 'fast' },
  { max: 1500, color: '#E8B44C', cssVar: 'var(--lat-mid)', tierClass: 'pf-mid', label: 'mid' },
  { max: Infinity, color: '#E2625F', cssVar: 'var(--lat-slow)', tierClass: 'pf-slow', label: 'slow' },
] as const

export type TtftTier = (typeof TTFT_TIER)[number]

export function ttftTierOf(ms: number): TtftTier {
  for (const tier of TTFT_TIER) {
    if (ms <= tier.max) return tier
  }
  return TTFT_TIER[TTFT_TIER.length - 1]
}

/** hex 色，用于内联渐变等无法引用 CSS 变量的场景。 */
export function getTtftColor(ms: number): string {
  return ttftTierOf(ms).color
}

/** 设计稿 prov-nums 着色类（pf-fast / pf-mid / pf-slow）。 */
export function getTtftTierClass(ms: number): TtftTier['tierClass'] {
  return ttftTierOf(ms).tierClass
}

/** 设计稿延迟区带 CSS 变量（--lat-fast / --lat-mid / --lat-slow）。 */
export function getTtftTierVar(ms: number): string {
  return ttftTierOf(ms).cssVar
}
