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

  it('falls back to all non-free models when no free models exist', () => {
    const selected = selectModelsForProbe(provider, [
      { id: 'z-paid' },
      { id: 'a-paid' },
      { id: 'b-paid' },
    ])

    // 没有 free 模型时不截断，返回全部普通模型
    expect(selected.map((model) => model.id)).toEqual(['a-paid', 'b-paid', 'z-paid'])
  })
})
