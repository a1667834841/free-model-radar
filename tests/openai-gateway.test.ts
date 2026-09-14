import { describe, expect, it, vi } from 'vitest'
import type { RadarEnv } from '@/domain/env'
import { findProvidersForModel, handleOpenAiGateway, rankAutoTargets } from '@/services/openai-gateway'
import type { ProviderConfigDocument } from '@/domain/provider'
import type { ResultsSnapshot } from '@/domain/result'

class MemoryKV {
  constructor(private readonly values: Record<string, string>) {}

  async get(key: string) {
    return this.values[key] ?? null
  }
}

const config: ProviderConfigDocument = {
  version: 1,
  updatedAt: '2026-09-14T00:00:00.000Z',
  providers: [
    {
      id: 'slow-provider',
      name: 'B.AI',
      baseUrl: 'https://slow.example.com/v1',
      secretName: 'SLOW_PROVIDER_KEY',
      enabled: true,
      modelStrategy: 'free-first',
      freeKeywords: ['free'],
      probe: { maxModels: 10, concurrency: 1, attempts: 1, timeoutMs: 10_000 },
    },
    {
      id: 'fast-provider',
      name: 'AIHubMix',
      baseUrl: 'https://fast.example.com/api/v1',
      secretName: 'FAST_PROVIDER_KEY',
      enabled: true,
      modelStrategy: 'free-first',
      freeKeywords: ['free'],
      probe: { maxModels: 10, concurrency: 1, attempts: 1, timeoutMs: 10_000 },
    },
  ],
}

const modelBase = {
  availability: 'available' as const,
  freeStatus: 'free' as const,
  prompt: 'probe',
  content: 'pong',
  tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  checkedAt: '2026-09-14T00:00:00.000Z',
  thinkingModeEnabled: true,
  thinkTagDetected: true,
}

const snapshot: ResultsSnapshot = {
  updatedAt: '2026-09-14T00:00:00.000Z',
  refreshId: 'refresh-1',
  providers: [
    {
      id: 'slow-provider',
      name: 'B.AI',
      status: 'healthy',
      models: [
        { ...modelBase, id: 'qwen3.8-27b', latencyMs: 500, ttftMs: 300, tokensPerSec: 20 },
        { ...modelBase, id: 'shared-model', latencyMs: 600, ttftMs: 400, tokensPerSec: 10 },
      ],
    },
    {
      id: 'fast-provider',
      name: 'AIHubMix',
      status: 'healthy',
      models: [
        { ...modelBase, id: 'coding-minimax-m3-free', latencyMs: 250, ttftMs: 100, tokensPerSec: 80 },
        { ...modelBase, id: 'shared-model', latencyMs: 200, ttftMs: 50, tokensPerSec: 100 },
      ],
    },
  ],
}

function makeEnv(overrides: Record<string, unknown> = {}): RadarEnv {
  return {
    RADAR_KV: new MemoryKV({
      'providers-config': JSON.stringify(config),
      'latest-results': JSON.stringify(snapshot),
    }) as unknown as KVNamespace,
    GATEWAY_API_KEY: 'gateway-secret',
    SLOW_PROVIDER_KEY: 'slow-secret',
    FAST_PROVIDER_KEY: 'fast-secret',
    ...overrides,
  }
}

function gatewayRequest(body: unknown, providerId?: string): Request {
  const headers = new Headers({
    Authorization: 'Bearer gateway-secret',
    'Content-Type': 'application/json',
  })
  if (providerId) headers.set('X-Provider-Id', providerId)
  return new Request('https://gateway.example.com/v1/chat/completions?trace=1', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('OpenAI gateway', () => {
  it('ranks automatic targets by TTFT first', () => {
    expect(rankAutoTargets(config, snapshot).map((target) => target.modelId)).toEqual([
      'coding-minimax-m3-free',
      'qwen3.8-27b',
    ])
  })

  it('ignores provider header for model=auto and rewrites the selected model', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    ))

    const response = await handleOpenAiGateway(
      gatewayRequest({ model: 'auto', messages: [{ role: 'user', content: 'hi' }], stream: true }, 'slow-provider'),
      makeEnv(),
      fetchImpl as typeof fetch,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Selected-Provider')).toBe('fast-provider')
    expect(response.headers.get('X-Selected-Model')).toBe('coding-minimax-m3-free')
    expect(await response.text()).toBe('data: [DONE]\n\n')

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url.toString()).toBe('https://fast.example.com/api/v1/chat/completions?trace=1')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fast-secret')
    expect(new Headers(init?.headers).has('X-Provider-Id')).toBe(false)
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'coding-minimax-m3-free',
      enable_thinking: true,
    })
  })

  it('returns an error when neither a provider nor a matching model is available', async () => {
    const response = await handleOpenAiGateway(
      gatewayRequest({ model: 'named-model', messages: [] }),
      makeEnv(),
      vi.fn() as unknown as typeof fetch,
    )

    expect(response.status).toBe(400)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('model_provider_not_found')
  })

  it('uses provider configuration order when a model ID exists at multiple providers', async () => {
    expect(findProvidersForModel(config, snapshot, 'shared-model').map((provider) => provider.id)).toEqual([
      'slow-provider',
      'fast-provider',
    ])

    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => Response.json({ id: 'completion-1' }),
    )
    const response = await handleOpenAiGateway(
      gatewayRequest({ model: 'shared-model', messages: [] }),
      makeEnv(),
      fetchImpl as typeof fetch,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Selected-Provider')).toBe('slow-provider')
    expect(fetchImpl.mock.calls[0][0].toString()).toBe('https://slow.example.com/v1/chat/completions?trace=1')
  })

  it('forwards a named model to the requested provider', async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => Response.json({ id: 'completion-1' }),
    )
    const response = await handleOpenAiGateway(
      gatewayRequest({ model: 'slow-model', messages: [] }, 'slow-provider'),
      makeEnv(),
      fetchImpl as typeof fetch,
    )

    expect(response.status).toBe(200)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url.toString()).toBe('https://slow.example.com/v1/chat/completions?trace=1')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer slow-secret')
    expect(response.headers.get('X-Selected-Provider')).toBe('slow-provider')
    expect(response.headers.get('X-Selected-Model')).toBe('slow-model')
  })

  it('excludes models without verified thinking evidence', () => {
    const withoutThinkEvidence: ResultsSnapshot = {
      ...snapshot,
      providers: snapshot.providers.map((provider) => ({
        ...provider,
        models: provider.models.map((model) => ({ ...model, thinkTagDetected: false })),
      })),
    }

    expect(rankAutoTargets(config, withoutThinkEvidence)).toEqual([])
  })

  it('rejects an invalid gateway key before loading provider data', async () => {
    const request = gatewayRequest({ model: 'auto', messages: [] })
    request.headers.set('Authorization', 'Bearer wrong')
    const response = await handleOpenAiGateway(request, makeEnv(), vi.fn() as unknown as typeof fetch)

    expect(response.status).toBe(401)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('invalid_api_key')
  })

  it('skips an automatic provider whose upstream secret is missing', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }))
    const response = await handleOpenAiGateway(
      gatewayRequest({ model: 'auto', messages: [] }),
      makeEnv({ FAST_PROVIDER_KEY: undefined }),
      fetchImpl as typeof fetch,
    )

    expect(response.headers.get('X-Selected-Provider')).toBe('slow-provider')
    expect(response.headers.get('X-Selected-Model')).toBe('qwen3.8-27b')
  })

  it('returns an OpenAI-shaped error when the upstream request fails', async () => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => { throw new Error('network failed') },
    )
    const response = await handleOpenAiGateway(
      gatewayRequest({ model: 'slow-model', messages: [] }, 'slow-provider'),
      makeEnv(),
      fetchImpl as typeof fetch,
    )

    expect(response.status).toBe(502)
    expect((await response.json() as { error: { code: string } }).error.code).toBe('upstream_request_failed')
  })
})
