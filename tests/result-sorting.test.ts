import { describe, expect, it } from 'vitest'
import { flattenAndSortProviderResults } from '@/domain/result'

describe('result sorting', () => {
  it('sorts globally by latency, provider name, then model id', () => {
    const sorted = flattenAndSortProviderResults([
      {
        id: 'b',
        name: 'Provider B',
        baseUrl: 'https://api-b.example.com/v1',
        status: 'healthy',
        models: [
          {
            id: 'z',
            latencyMs: 100,
            availability: 'available',
            freeStatus: 'available',
            prompt: 'Reply with exactly: pong',
            content: 'pong',
            tokenUsage: { promptTokens: null, completionTokens: null, totalTokens: null },
            checkedAt: 'now',
          },
        ],
      },
      {
        id: 'a',
        name: 'Provider A',
        baseUrl: 'https://api-a.example.com/v1',
        status: 'healthy',
        models: [
          {
            id: 'b',
            latencyMs: 100,
            availability: 'available',
            freeStatus: 'free',
            prompt: 'Reply with exactly: pong',
            content: 'pong',
            tokenUsage: { promptTokens: null, completionTokens: null, totalTokens: null },
            checkedAt: 'now',
          },
          {
            id: 'a',
            latencyMs: 50,
            availability: 'available',
            freeStatus: 'free',
            prompt: 'Reply with exactly: pong',
            content: 'pong',
            tokenUsage: { promptTokens: null, completionTokens: null, totalTokens: null },
            checkedAt: 'now',
          },
        ],
      },
    ])

    expect(sorted.map((model) => `${model.providerName}:${model.id}`)).toEqual([
      'Provider A:a',
      'Provider A:b',
      'Provider B:z',
    ])
  })
})