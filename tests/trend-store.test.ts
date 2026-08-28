import { describe, expect, it } from 'vitest'
import { createTrendResponse, type TrendSample } from '@/domain/trend'
import { appendTrendSamples, getTrendBucket } from '@/storage/trend-store'

class MemoryKV {
  store = new Map<string, string>()
  deletedKeys: string[] = []

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async put(key: string, value: string) {
    this.store.set(key, value)
  }

  async delete(key: string) {
    this.deletedKeys.push(key)
    this.store.delete(key)
  }
}

function sample(overrides: Partial<TrendSample>): TrendSample {
  return {
    providerId: 'provider-a',
    providerName: 'Provider A',
    modelId: 'model-a',
    checkedAt: '2026-08-28T09:00:00.000Z',
    status: 'ok',
    ttftMs: 100,
    tokensPerSec: 20,
    latencyMs: 900,
    ...overrides,
  }
}

describe('trend store', () => {
  it('appends samples into daily KV buckets and prunes the eighth older day', async () => {
    const kv = new MemoryKV()

    await appendTrendSamples(kv as unknown as KVNamespace, [
      sample({ checkedAt: '2026-08-28T09:00:00.000Z', modelId: 'model-a' }),
      sample({ checkedAt: '2026-08-28T10:00:00.000Z', modelId: 'model-b' }),
    ])

    const bucket = await getTrendBucket(kv as unknown as KVNamespace, '2026-08-28')
    expect(bucket?.samples.map((item) => item.modelId)).toEqual(['model-a', 'model-b'])
    expect(kv.deletedKeys).toContain('trend:2026-08-20')
  })

  it('computes model and provider trend statistics while keeping failed samples in success rate', () => {
    const response = createTrendResponse([
      sample({ ttftMs: 100, tokensPerSec: 20, latencyMs: 800 }),
      sample({ checkedAt: '2026-08-28T10:00:00.000Z', ttftMs: 200, tokensPerSec: 22, latencyMs: 900 }),
      sample({ checkedAt: '2026-08-28T11:00:00.000Z', status: 'failed', ttftMs: null, tokensPerSec: null, latencyMs: null }),
      sample({ checkedAt: '2026-08-28T12:00:00.000Z', ttftMs: 1000, tokensPerSec: 10, latencyMs: 1800 }),
    ], 7, '2026-08-28T12:10:00.000Z')

    expect(response.modelStats).toHaveLength(1)
    expect(response.modelStats[0].sampleCount).toBe(4)
    expect(response.modelStats[0].successRate).toBe(0.75)
    expect(response.modelStats[0].median.ttftMs).toBe(200)
    expect(response.modelStats[0].avg.ttftMs).toBeCloseTo(433.333, 3)
    expect(response.modelStats[0].p95.ttftMs).toBe(1000)
    expect(response.providerStats[0].successRate).toBe(0.75)
  })
})
