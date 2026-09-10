import { describe, expect, it } from 'vitest'
import { classifyModelCost } from '@/domain/model-cost'
import { selectModelsForProbe } from '@/domain/model'
import { providerConfigSchema } from '@/domain/provider'
import { modelDiscoveryInternals } from '@/services/provider-discovery'

const provider = providerConfigSchema.parse({
  id: 'example', name: 'Example', baseUrl: 'https://example.com/v1', secretName: 'EXAMPLE_KEY',
  modelStrategy: 'free-first', freeKeywords: ['free'],
  probe: { maxModels: 2, concurrency: 1, attempts: 1, timeoutMs: 1000 },
})

describe('model billing evidence', () => {
  it('requires both prices to be explicit zero', () => {
    expect(classifyModelCost(provider, { id: 'm', pricing: { prompt: '0', completion: 0 } }).type).toBe('free')
    for (const value of ['', ' ', null, undefined, 'NaN', -1, Infinity]) {
      expect(classifyModelCost(provider, { id: 'free', pricing: { prompt: value, completion: 0 } }).type).toBe('unknown')
    }
  })

  it('prioritizes positive prices over flags, names and configuration', () => {
    const configured = { ...provider, billing: { defaultType: 'free' as const, source: 'manual' } }
    expect(classifyModelCost(configured, { id: 'free', isFree: true, pricing: { prompt: 1 } }).type).toBe('paid')
    expect(classifyModelCost(configured, { id: 'free', pricings: { prompt: [{ value: 0 }, { value: 2 }], completion: [{ value: 0 }] } }).type).toBe('paid')
  })

  it('keeps free-route hints and names unknown, recognizes free flags', () => {
    expect(classifyModelCost(provider, { id: 'free' }).type).toBe('unknown')
    expect(classifyModelCost(provider, { id: 'm', hasFreeRoute: true }).type).toBe('unknown')
    expect(classifyModelCost(provider, { id: 'm', isFree: true }).type).toBe('free-quota')
    const [model] = modelDiscoveryInternals.parseModelsPayload({ data: [{ id: 'free', free: false }] })
    expect(selectModelsForProbe(provider, [model])).toEqual([])
  })

  it('supports exact model rules over provider defaults with evidence', () => {
    const configured = { ...provider, billing: { defaultType: 'free-quota' as const, source: 'Account plan', models: { special: 'trial' as const } } }
    expect(classifyModelCost(configured, { id: 'special' }, '2026-09-11T00:00:00Z')).toEqual({ type: 'trial', source: 'config', evidence: 'Account plan', checkedAt: '2026-09-11T00:00:00Z' })
    expect(classifyModelCost(configured, { id: 'other' }).type).toBe('free-quota')
  })

  it('enforces all three probe policies and model limits', () => {
    const models = [{ id: 'a-free', pricing: { prompt: 1 } }, { id: 'b-unknown' }, { id: 'c-zero', pricing: { prompt: 0, completion: 0 } }]
    expect(selectModelsForProbe(provider, models).map(m => m.id)).toEqual(['c-zero'])
    expect(selectModelsForProbe({ ...provider, probe: { ...provider.probe, costPolicy: 'free-only' } }, models).map(m => m.id)).toEqual(['c-zero'])
    expect(selectModelsForProbe({ ...provider, probe: { ...provider.probe, costPolicy: 'all' } }, models).map(m => m.id)).toEqual(['a-free', 'b-unknown'])
  })

  it('applies the probe limit after due-model filtering', () => {
    const state = {
      'example:a': { providerId: 'example', modelId: 'a', consecutiveFailures: 0, requestFailureCount: 0, hidden: false, hiddenReason: null, lastCheckedAt: '2026-09-11T00:00:00Z', lastStatus: 'ok' as const },
    }
    const due = [{ id: 'a', pricing: { prompt: 0, completion: 0 } }, { id: 'b', pricing: { prompt: 0, completion: 0 } }]
    expect(due.filter(model => model.id === 'b' || model.id === 'a' && state[`example:${model.id}`] === undefined).slice(0, 1).map(model => model.id)).toEqual(['b'])
  })
})
