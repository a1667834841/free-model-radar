import { describe, expect, it } from 'vitest'
import { parseProviderConfigDocument } from '@/domain/provider'

describe('provider config validation', () => {
  it('accepts valid provider config documents', () => {
    const config = parseProviderConfigDocument({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [{
        id: 'provider-a',
        name: 'Provider A',
        baseUrl: 'https://api.example.com/v1',
        secretName: 'PROVIDER_A_KEY',
        enabled: true,
        modelStrategy: 'free-first',
        freeKeywords: ['free'],
        probe: { maxModels: 20, concurrency: 3, attempts: 1, timeoutMs: 10000 },
      }],
    })

    expect(config.providers[0].id).toBe('provider-a')
  })

  it('rejects non-https base urls', () => {
    expect(() => parseProviderConfigDocument({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [{
        id: 'provider-a',
        name: 'Provider A',
        baseUrl: 'http://api.example.com/v1',
        secretName: 'PROVIDER_A_KEY',
        enabled: true,
        modelStrategy: 'free-first',
        freeKeywords: ['free'],
        probe: { maxModels: 20, concurrency: 3, attempts: 1, timeoutMs: 10000 },
      }],
    })).toThrow()
  })

  it('rejects invalid secret names', () => {
    expect(() => parseProviderConfigDocument({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [{
        id: 'provider-a',
        name: 'Provider A',
        baseUrl: 'https://api.example.com/v1',
        secretName: 'provider-key',
        enabled: true,
        modelStrategy: 'free-first',
        freeKeywords: ['free'],
        probe: { maxModels: 20, concurrency: 3, attempts: 1, timeoutMs: 10000 },
      }],
    })).toThrow()
  })
})
