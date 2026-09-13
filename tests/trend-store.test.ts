import { describe, expect, it } from 'vitest'
import { createTrendResponse, type TrendSample } from '@/domain/trend'
import { appendTrendSamples, getTrendResponse } from '@/storage/trend-store'

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

class MemoryD1 {
  rows: Array<{
    id: number
    providerId: string
    providerName: string
    modelId: string
    checkedAt: string
    status: TrendSample['status']
    ttftMs: number | null
    tokensPerSec: number | null
    latencyMs: number | null
  }> = []
  nextId = 1

  prepare(sql: string) {
    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          if (sql.includes('INSERT INTO trend_samples')) {
            const [providerId, providerName, modelId, checkedAt, status, ttftMs, tokensPerSec, latencyMs] = params as [string, string, string, string, TrendSample['status'], number | null, number | null, number | null]
            const existing = this.rows.find((row) => row.providerId === providerId && row.modelId === modelId && row.checkedAt === checkedAt)
            if (existing) Object.assign(existing, { providerName, status, ttftMs, tokensPerSec, latencyMs })
            else this.rows.push({ id: this.nextId++, providerId, providerName, modelId, checkedAt, status, ttftMs, tokensPerSec, latencyMs })
          }
          if (sql.includes('DELETE FROM trend_samples')) {
            const [cutoff] = params as [string]
            this.rows = this.rows.filter((row) => row.checkedAt >= cutoff)
          }
          return { success: true, meta: { changes: 1 } }
        },
        all: async <T>() => ({ results: this.rows.slice().sort((a, b) => a.checkedAt.localeCompare(b.checkedAt)).map((row) => ({
          provider_id: row.providerId,
          provider_name: row.providerName,
          model_id: row.modelId,
          checked_at: row.checkedAt,
          status: row.status,
          ttft_ms: row.ttftMs,
          tokens_per_sec: row.tokensPerSec,
          latency_ms: row.latencyMs,
        })) as unknown as T[] }),
      }),
    }
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
  it('appends samples directly into D1', async () => {
    const db = new MemoryD1()
    const checkedAt = new Date().toISOString()

    await appendTrendSamples(db as unknown as D1Database, [
      sample({ checkedAt, modelId: 'model-a' }),
      sample({ checkedAt: new Date(Date.now() + 1).toISOString(), modelId: 'model-b' }),
    ])

    expect(db.rows.map((item) => item.modelId)).toEqual(['model-a', 'model-b'])
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

  it('filters trend response to active models while limiting chart samples per model per day', () => {
    const activeSamples = Array.from({ length: 30 }, (_, index) => sample({
      checkedAt: new Date(Date.UTC(2026, 7, 28, 0, index)).toISOString(),
      modelId: 'active-model',
      ttftMs: 100 + index,
    }))
    const staleSamples = [sample({ modelId: 'stale-model', checkedAt: '2026-08-28T12:00:00.000Z' })]

    const response = createTrendResponse(
      [...activeSamples, ...staleSamples],
      7,
      '2026-08-28T12:10:00.000Z',
      new Set(['provider-a:active-model']),
    )

    expect(response.modelStats).toHaveLength(1)
    expect(response.modelStats[0].modelId).toBe('active-model')
    expect(response.modelStats[0].sampleCount).toBe(30)
    expect(response.samples).toHaveLength(24)
    expect(response.samples.every((item) => item.modelId === 'active-model')).toBe(true)
    expect(response.samples[0].checkedAt).toBe('2026-08-28T00:06:00.000Z')
    expect(response.samples.at(-1)?.checkedAt).toBe('2026-08-28T00:29:00.000Z')
  })

  it('writes new samples to D1 and reads them back as the durable source', async () => {
    const kv = new MemoryKV()
    const db = new MemoryD1()
    const checkedAt = new Date().toISOString()
    const item = sample({ checkedAt })

    await appendTrendSamples(db as unknown as D1Database, [item])

    expect(db.rows).toHaveLength(1)
    const response = await getTrendResponse(kv as unknown as KVNamespace, 7, db as unknown as D1Database)
    expect(response.samples).toEqual([item])
    expect(response.modelStats[0]?.sampleCount).toBe(1)
  })
})
