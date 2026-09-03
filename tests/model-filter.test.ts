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
  it('selects Cloudflare text-generation models from the account catalog', () => {
    const cloudflareProvider: ProviderConfig = { ...provider, id: 'cloudflare-workers-ai', apiStyle: 'cloudflare-workers-ai', accountId: 'account', freeKeywords: ['@cf/'] }
    expect(selectModelsForProbe(cloudflareProvider, [
      { id: '@cf/meta/llama-3.1-8b-instruct', task: 'Text Generation' },
      { id: '@cf/invalid/embedding', task: 'Text Embeddings' },
    ]).map((model) => model.id)).toEqual(['@cf/meta/llama-3.1-8b-instruct'])
  })
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

  it('selects GMI Cloud models with isFree flag', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'gmicloud' }, [
      { id: 'paid-model', pricing: { prompt: '0.000001', completion: '0.000002' } },
      { id: 'minimax-m3', isFree: true, pricing: { prompt: '0', completion: '0' } },
      { id: 'minimax-m2.7', isFree: true, pricing: { prompt: '0', completion: '0' } },
    ])

    expect(selected.map((model) => model.id)).toEqual(['minimax-m2.7', 'minimax-m3'])
  })

  it('does not fallback to all GMI Cloud models when no isFree models exist', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'gmicloud' }, [
      { id: 'paid-a', pricing: { prompt: '0.1', completion: '0.2' } },
      { id: 'paid-b', pricing: { prompt: '0.3', completion: '0.4' } },
    ])

    expect(selected).toEqual([])
  })

  it('selects ZenMux models with zero pricings prompt and completion', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'zenmux' }, [
      { id: 'paid', pricings: { prompt: [{ value: 0.16 }], completion: [{ value: 0.47 }] } },
      { id: 'free-by-pricings', pricings: { prompt: [{ value: 0 }], completion: [{ value: 0 }] } },
      { id: 'also-free-by-keyword:free', pricings: { prompt: [{ value: 1 }], completion: [{ value: 1 }] } },
    ])

    expect(selected.map((model) => model.id)).toEqual(['also-free-by-keyword:free', 'free-by-pricings'])
  })

  it('treats ZenMux completion-only zero pricing as paid', () => {
    const selected = selectModelsForProbe({ ...provider, id: 'zenmux' }, [
      { id: 'completion-only-zero', pricings: { completion: [{ value: 0 }] } },
      { id: 'paid', pricings: { prompt: [{ value: 0.1 }], completion: [{ value: 0.2 }] } },
    ])

    expect(selected).toEqual([])
  })

  it('selects NVIDIA NIM free endpoint models by exact keywords', () => {
    const nvidiaProvider: ProviderConfig = {
      ...provider,
      id: 'nvidia',
      freeKeywords: ['kimi-k3', 'deepseek-v4-flash-0731', 'nemotron-3-ultra'],
      probe: { ...provider.probe, maxModels: 10 },
    }
    const selected = selectModelsForProbe(nvidiaProvider, [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b' },
      { id: 'moonshotai/kimi-k3' },
      { id: 'google/gemma-2b' },
      { id: 'meta/llama2-70b' },
      { id: 'deepseek-ai/deepseek-v4-flash-0731' },
    ])

    expect(selected.map((model) => model.id)).toEqual([
      'deepseek-ai/deepseek-v4-flash-0731',
      'moonshotai/kimi-k3',
      'nvidia/nemotron-3-ultra-550b-a55b',
    ])
  })

  it('does not select NVIDIA NIM paid models when only free candidates exist', () => {
    const nvidiaProvider: ProviderConfig = {
      ...provider,
      id: 'nvidia',
      freeKeywords: ['kimi-k3', 'deepseek-v4-flash-0731'],
    }
    const selected = selectModelsForProbe(nvidiaProvider, [
      { id: 'google/gemma-2b' },
      { id: 'meta/llama2-70b' },
    ])

    expect(selected).toEqual([])
  })

  it('selects the AMD Radeon Cloud DeepSeek V4 Flash candidate by model keyword', () => {
    const amdProvider: ProviderConfig = {
      ...provider,
      id: 'amd',
      freeKeywords: ['deepseek-v4-flash'],
      probe: { ...provider.probe, maxModels: 1 },
    }
    const selected = selectModelsForProbe(amdProvider, [
      { id: 'GLM-5.3-Flash' },
      { id: 'DeepSeek-V4-Flash' },
      { id: 'Qwen3.8-Flash-Next' },
    ])

    expect(selected.map((model) => model.id)).toEqual(['DeepSeek-V4-Flash'])
  })

  it('selects the Flatkey DeepSeek V4 Flash candidate by model keyword', () => {
    const flatkeyProvider: ProviderConfig = {
      ...provider,
      id: 'flatkey',
      freeKeywords: ['deepseek-v4-flash'],
      probe: { ...provider.probe, maxModels: 1 },
    }
    const selected = selectModelsForProbe(flatkeyProvider, [
      { id: 'deepseek-v4-pro' },
      { id: 'deepseek-v4-flash' },
      { id: 'gpt-5.6-luna' },
    ])

    expect(selected.map((model) => model.id)).toEqual(['deepseek-v4-flash'])
  })

})
