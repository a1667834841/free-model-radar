import { describe, expect, it } from 'vitest'
import { computeRrfScore, findFastestTtftModel, findModelBest, getEvaluationMethod, hasPreferredModelKeyword, normalizeRrfScore } from '@/domain/evaluation'
import type { FlattenedModel } from '@/domain/evaluation'

function makeModel(overrides: Partial<FlattenedModel> & Pick<FlattenedModel, 'id' | 'providerId' | 'providerName'>): FlattenedModel {
  return {
    latencyMs: 1000,
    ttftMs: 200,
    tokensPerSec: 50,
    availability: 'available',
    freeStatus: 'free',
    prompt: 'Reply with exactly: pong',
    content: 'pong',
    tokenUsage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    checkedAt: 'now',
    ...overrides,
  }
}

describe('streaming performance evaluation', () => {
  it('computes RRF from metric ranks', () => {
    expect(computeRrfScore([1, 2, 3])).toBeCloseTo(1 / 61 + 1 / 62 + 1 / 63)
    expect(computeRrfScore([1], [2])).toBeCloseTo(2 / 61)
  })

  it('normalizes the best weighted RRF score to 100', () => {
    expect(normalizeRrfScore(computeRrfScore([1, 1, 1], [1, 2, 1]))).toBeCloseTo(100)
  })

  it('ranks models by weighted RRF score descending', () => {
    const method = getEvaluationMethod('streaming-performance')
    const ranked = method.rank([
      makeModel({ id: 'a', providerId: 'a', providerName: 'A', ttftMs: 100, tokensPerSec: 10, latencyMs: 300 }),
      makeModel({ id: 'b', providerId: 'b', providerName: 'B', ttftMs: 200, tokensPerSec: 50, latencyMs: 200 }),
      makeModel({ id: 'c', providerId: 'c', providerName: 'C', ttftMs: 300, tokensPerSec: 100, latencyMs: 100 }),
    ])

    expect(ranked.map((model) => model.id)).toEqual(['c', 'b', 'a'])
    expect(ranked[0].rank).toBe(1)
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score ?? 0)
  })

  it('reduces the influence of throughput above 300 t/s', () => {
    const method = getEvaluationMethod('streaming-performance')
    const ranked = method.rank([
      makeModel({ id: 'outlier', providerId: 'a', providerName: 'A', ttftMs: 100, tokensPerSec: 500, latencyMs: 100 }),
      makeModel({ id: 'balanced', providerId: 'b', providerName: 'B', ttftMs: 200, tokensPerSec: 100, latencyMs: 200 }),
    ])

    expect(ranked.map((model) => model.id)).toEqual(['balanced', 'outlier'])
  })

  it('derives legacy metrics when streaming fields are missing', () => {
    const method = getEvaluationMethod('streaming-performance')
    const ranked = method.rank([
      makeModel({
        id: 'legacy',
        providerId: 'a',
        providerName: 'A',
        latencyMs: 1200,
        ttftMs: undefined,
        tokensPerSec: undefined,
        tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    ])

    expect(ranked[0].ttftMs).toBe(1200)
    expect(ranked[0].tokensPerSec).toBeCloseTo(20 / 1.2)
    expect(ranked[0].tpsQuality).toBe('provider-usage')
  })

  it('keeps content-estimated throughput out of the TPS rank', () => {
    const method = getEvaluationMethod('streaming-performance')
    const ranked = method.rank([
      makeModel({
        id: 'estimated',
        providerId: 'a',
        providerName: 'A',
        tokensPerSec: 1000,
        tokenUsage: { promptTokens: null, completionTokens: null, totalTokens: null },
      }),
      makeModel({
        id: 'measured',
        providerId: 'b',
        providerName: 'B',
        tokensPerSec: 50,
        tokenUsage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
      }),
    ])

    expect(ranked.find((model) => model.id === 'estimated')?.tpsQuality).toBe('estimated')
    expect(ranked[0].id).toBe('measured')
    expect(ranked.find((model) => model.id === 'estimated')?.score).toBeLessThan(ranked.find((model) => model.id === 'measured')?.score ?? Infinity)
  })

  it('promotes preferred model families and demotes unrecognized names', () => {
    expect(hasPreferredModelKeyword('anthropic/claude-sonnet-4')).toBe(true)
    expect(hasPreferredModelKeyword('custom-model')).toBe(false)

    const method = getEvaluationMethod('streaming-performance')
    const ranked = method.rank([
      makeModel({ id: 'custom-model', providerId: 'a', providerName: 'A', ttftMs: 250, tokensPerSec: 40, latencyMs: 1100 }),
      makeModel({ id: 'qwen3.5', providerId: 'b', providerName: 'B' }),
    ])

    expect(ranked[0].id).toBe('qwen3.5')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score ?? 0)
  })

  it('finds fastest TTFT independently from composite ranking', () => {
    const fastest = findFastestTtftModel([
      makeModel({ id: 'best-score', providerId: 'a', providerName: 'A', ttftMs: 300, tokensPerSec: 200 }),
      makeModel({ id: 'fastest-ttft', providerId: 'b', providerName: 'B', ttftMs: 120, tokensPerSec: 20 }),
    ])

    expect(fastest).toEqual({ id: 'fastest-ttft', ttftMs: 120 })
  })

  it('finds best TTFT, TPS and E2E across providers', () => {
    const best = findModelBest([
      makeModel({ id: 'a', providerId: 'p1', providerName: 'P1', ttftMs: 200, tokensPerSec: 20, latencyMs: 300 }),
      makeModel({ id: 'b', providerId: 'p1', providerName: 'P1', ttftMs: 150, tokensPerSec: 40, latencyMs: 500 }),
      makeModel({ id: 'c', providerId: 'p2', providerName: 'P2', ttftMs: 250, tokensPerSec: 10, latencyMs: 120 }),
    ])

    expect(best.bestTtft).toEqual({ providerId: 'p1', id: 'b', value: 150 })
    expect(best.bestTps).toEqual({ providerId: 'p1', id: 'b', value: 40 })
    expect(best.bestE2e).toEqual({ providerId: 'p2', id: 'c', value: 120 })
  })
})

describe('latency evaluation', () => {
  it('sorts by end-to-end latency ascending', () => {
    const method = getEvaluationMethod('latency')
    const ranked = method.rank([
      makeModel({ id: 'b', providerId: 'a', providerName: 'A', latencyMs: 500 }),
      makeModel({ id: 'a', providerId: 'a', providerName: 'A', latencyMs: 200 }),
    ])

    expect(ranked.map((model) => model.id)).toEqual(['a', 'b'])
    expect(ranked[0].score).toBeNull()
  })
})
