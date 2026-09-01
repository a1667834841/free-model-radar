import { describe, expect, it } from 'vitest'
import type { ModelTrendStats, TrendMetricKey } from '../src/domain/trend'
import {
  selectPreferredTrendModelsForLiveRanking,
  selectTrendModelsForLiveRanking,
  collectHoverRowsAtIndex,
} from '../src/domain/trend-view'

type LiveModel = { providerId: string; providerName: string; id: string }

function stat(providerId: string, modelId: string, ttftMs: number, tps = 10): ModelTrendStats {
  return {
    providerId,
    providerName: providerId.toUpperCase(),
    modelId,
    sampleCount: 2,
    successCount: 2,
    successRate: 1,
    lastCheckedAt: '2026-08-29T00:00:00.000Z',
    current: { ttftMs, tokensPerSec: tps, latencyMs: ttftMs + 100 },
    avg: { ttftMs, tokensPerSec: tps, latencyMs: ttftMs + 100 },
    median: { ttftMs, tokensPerSec: tps, latencyMs: ttftMs + 100 },
    p95: { ttftMs, tokensPerSec: tps, latencyMs: ttftMs + 100 },
  }
}

describe('selectTrendModelsForLiveRanking', () => {
  it('uses realtime overview ranking order instead of resorting by the selected trend metric', () => {
    const liveRanking: LiveModel[] = [
      { providerId: 'p1', providerName: 'P1', id: 'live-first' },
      { providerId: 'p1', providerName: 'P1', id: 'live-second' },
      { providerId: 'p2', providerName: 'P2', id: 'live-third' },
    ]
    const trendStats = [
      stat('p2', 'live-third', 300, 100),
      stat('p1', 'live-second', 200, 200),
      stat('p1', 'live-first', 100, 1),
    ]

    const selected = selectTrendModelsForLiveRanking(trendStats, liveRanking, 10)

    expect(selected.map((model) => model.modelId)).toEqual(['live-first', 'live-second', 'live-third'])
  })

  it('caps the selected trend models to the first 10 live models with trend data', () => {
    const liveRanking = Array.from({ length: 12 }, (_, i) => ({ providerId: 'p', providerName: 'P', id: `m${i}` }))
    const trendStats = liveRanking.map((model, i) => stat(model.providerId, model.id, i + 1))

    const selected = selectTrendModelsForLiveRanking(trendStats, liveRanking, 10)

    expect(selected).toHaveLength(10)
    expect(selected.map((model) => model.modelId)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'])
  })

  it('returns no chart models when historical ids no longer match live ids', () => {
    const selected = selectTrendModelsForLiveRanking(
      [stat('old-provider', 'old-model', 100)],
      [{ providerId: 'new-provider', providerName: 'New', id: 'new-model' }],
    )

    expect(selected).toEqual([])
  })

  it('selects the first ten qwen, deepseek, and glm models for the chart', () => {
    const liveRanking = [
      { providerId: 'p', providerName: 'P', id: 'other-model' },
      ...Array.from({ length: 12 }, (_, i) => ({
        providerId: 'p',
        providerName: 'P',
        id: i % 3 === 0 ? `qwen-${i}` : i % 3 === 1 ? `deepseek-${i}` : `glm-${i}`,
      })),
    ]
    const trendStats = liveRanking.map((model, i) => stat(model.providerId, model.id, i + 1))

    const selected = selectPreferredTrendModelsForLiveRanking(trendStats, liveRanking)

    expect(selected).toHaveLength(10)
    expect(selected.every((model) => /qwen|deepseek|glm/i.test(model.modelId))).toBe(true)
    expect(selected.map((model) => model.modelId)).toEqual([
      'qwen-0', 'deepseek-1', 'glm-2', 'qwen-3', 'deepseek-4',
      'glm-5', 'qwen-6', 'deepseek-7', 'glm-8', 'qwen-9',
    ])
  })
})

describe('collectHoverRowsAtIndex', () => {
  it('returns data for every visible series at the hovered sample index even when timestamps differ', () => {
    const rows = collectHoverRowsAtIndex(
      [
        { key: 'a', name: 'A', color: 'red', pts: [{ t: 1000, v: 10 }, { t: 2000, v: 20 }] },
        { key: 'b', name: 'B', color: 'blue', pts: [{ t: 1100, v: 11 }, { t: 2100, v: 21 }] },
        { key: 'c', name: 'C', color: 'green', pts: [{ t: 1200, v: 12 }, { t: 2200, v: 22 }] },
      ],
      1,
      'ttftMs' satisfies TrendMetricKey,
    )

    expect(rows.map((row) => row.name)).toEqual(['C', 'B', 'A'])
    expect(rows.map((row) => row.value)).toEqual([22, 21, 20])
  })

  it('keeps TPS hover rows sorted descending because higher is better in the displayed chart tooltip', () => {
    const rows = collectHoverRowsAtIndex(
      [
        { key: 'slow', name: 'Slow', color: 'red', pts: [{ t: 1, v: 5 }] },
        { key: 'fast', name: 'Fast', color: 'blue', pts: [{ t: 2, v: 50 }] },
      ],
      0,
      'tokensPerSec' satisfies TrendMetricKey,
    )

    expect(rows.map((row) => row.name)).toEqual(['Fast', 'Slow'])
  })
})
