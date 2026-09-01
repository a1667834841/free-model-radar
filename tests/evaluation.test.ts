import { describe, expect, it } from 'vitest'
import { computeStreamingScore, findFastestTtftModel, findModelBest, getEvaluationMethod } from '@/domain/evaluation'
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
  it('computes score as throughput divided by ttft seconds plus epsilon', () => {
    expect(computeStreamingScore(200, 50)).toBeCloseTo(50 / (0.2 + 0.1))
  })

  it('ranks models by composite score descending', () => {
    const method = getEvaluationMethod('streaming-performance')
    const ranked = method.rank([
      makeModel({ id: 'slow', providerId: 'a', providerName: 'A', ttftMs: 800, tokensPerSec: 30 }),
      makeModel({ id: 'fast', providerId: 'b', providerName: 'B', ttftMs: 150, tokensPerSec: 80 }),
      makeModel({ id: 'mid', providerId: 'c', providerName: 'C', ttftMs: 300, tokensPerSec: 60 }),
    ])

    expect(ranked.map((model) => model.id)).toEqual(['fast', 'mid', 'slow'])
    expect(ranked[0].rank).toBe(1)
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score ?? 0)
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

  it('keeps content-estimated throughput out of composite score', () => {
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
    expect(ranked.find((model) => model.id === 'estimated')?.score).toBeNull()
    expect(ranked[0].id).toBe('measured')
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
