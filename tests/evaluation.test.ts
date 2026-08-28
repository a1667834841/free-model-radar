import { describe, expect, it } from 'vitest'
import { computeStreamingScore, getEvaluationMethod } from '@/domain/evaluation'
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
