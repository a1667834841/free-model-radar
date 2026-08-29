import { describe, expect, it } from 'vitest'
import { isFreeModel, selectModelsForProbe } from '@/domain/model'
import type { ProviderConfig } from '@/domain/provider'

const provider: ProviderConfig = {
  id: 'provider-a',
  name: 'Provider A',
  baseUrl: 'https://api.example.com/v1',
  secretName: 'PROVIDER_A_KEY',
  enabled: true,
  modelStrategy: 'free-first',
  freeKeywords: ['free', ':free'],
  probe: { maxModels: 2, concurrency: 3, attempts: 1, timeoutMs: 10000 },
}

describe('model filtering', () => {
  it('detects free models by configured keywords', () => {
    expect(isFreeModel('qwen/qwen3:free', provider.freeKeywords)).toBe(true)
    expect(isFreeModel('gemini-flash', provider.freeKeywords)).toBe(false)
  })

  it('selects free models first and applies maxModels after sorting', () => {
    const selected = selectModelsForProbe(provider, [
      { id: 'z-paid' },
      { id: 'b-free' },
      { id: 'a-free' },
      { id: 'c-free' },
    ])

    expect(selected.map((model) => model.id)).toEqual(['a-free', 'b-free'])
  })

  it('falls back to all non-free models when no free models exist in a small provider', () => {
    const selected = selectModelsForProbe(provider, [
      { id: 'z-paid' },
      { id: 'a-paid' },
      { id: 'b-paid' },
    ])

    expect(selected.map((model) => model.id)).toEqual(['a-paid', 'b-paid', 'z-paid'])
  })

  it('skips large providers with no free candidates instead of probing all models', () => {
    const selected = selectModelsForProbe(provider, Array.from({ length: 21 }, (_, index) => ({ id: `paid-${index}` })))

    expect(selected).toEqual([])
  })

  it('selects OpenRouter models with zero prompt and completion pricing', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'openrouter' }, [
      { id: 'paid', pricing: { prompt: '0.1', completion: '0' } },
      { id: 'free-by-pricing', pricing: { prompt: '0', completion: '0' } },
      { id: 'also-free-by-keyword:free', pricing: { prompt: '1', completion: '1' } },
    ])

    expect(selected.map((model) => model.id)).toEqual(['also-free-by-keyword:free', 'free-by-pricing'])
  })

  it('does not fallback to all OpenRouter models when no pricing-free models are due', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'openrouter' }, [
      { id: 'paid-a', pricing: { prompt: '0.1', completion: '0.2' } },
      { id: 'paid-b', pricing: { prompt: '0.3', completion: '0.4' } },
    ])

    expect(selected).toEqual([])
  })

  it('selects RNTM models with hasFreeRoute', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'rntm' }, [
      { id: 'paid', hasFreeRoute: false },
      { id: 'free-route', hasFreeRoute: true },
    ])

    expect(selected.map((model) => model.id)).toEqual(['free-route'])
  })
})
