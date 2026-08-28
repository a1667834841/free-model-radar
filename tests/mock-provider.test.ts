import { describe, expect, it } from 'vitest'
import { runRefresh, startRefresh, processRefreshMessage } from '@/services/refresh-service'
import type { RadarEnv } from '@/domain/env'
import type { RefreshQueueMessage } from '@/domain/refresh'
import { recordModelFailure, type ModelHealthState } from '@/services/model-health-service'

function streamingProbeResponse(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"po"}}]}\n\n',
    usage
      ? `data: {"choices":[{"delta":{"content":"ng"}}],"usage":${JSON.stringify(usage)}}\n\n`
      : 'data: {"choices":[{"delta":{"content":"ng"}}]}\n\n',
    'data: [DONE]\n\n',
  ]
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

class MemoryKV {
  store = new Map<string, string>()
  failGetKeys = new Set<string>()

  async get(key: string) {
    if (this.failGetKeys.has(key)) {
      throw new Error(`KV GET failed for ${key}`)
    }
    return this.store.get(key) ?? null
  }

  async put(key: string, value: string) {
    this.store.set(key, value)
  }

  async delete(key: string) {
    this.store.delete(key)
  }
}

describe('mock provider refresh', () => {
  it('discovers free models, probes them, and stores latest results', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [{
        id: 'provider-a',
        name: 'Provider A',
        baseUrl: 'https://api.example.com/v1',
        secretName: 'PROVIDER_A_KEY',
        enabled: true,
        modelStrategy: 'free-first',
        freeKeywords: ['free', ':free'],
        probe: { maxModels: 20, concurrency: 2, attempts: 1, timeoutMs: 10000 },
      }],
    }))

    const env = {
      RADAR_KV: kv as unknown as KVNamespace,
      PROVIDER_A_KEY: 'key',
      REFRESH_ADMIN_TOKEN: 'admin',
    } satisfies RadarEnv

    const calls: string[] = []
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = input.toString()
      calls.push(url)
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'paid-model' }, { id: 'free-model' }] }), { status: 200 })
      }
      return streamingProbeResponse({ prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 })
    }

    await runRefresh(env, 'refresh-test', fetchImpl as typeof fetch)

    const latestResults = JSON.parse((await kv.get('latest-results')) ?? 'null')
    expect(latestResults.providers[0].status).toBe('healthy')
    expect(latestResults.providers[0].models).toHaveLength(1)
    expect(latestResults.providers[0].models[0].id).toBe('free-model')
    expect(latestResults.providers[0].models[0].freeStatus).toBe('free')
    expect(latestResults.providers[0].models[0].tokenUsage.totalTokens).toBe(4)
    expect(calls.some((call) => call.endsWith('/chat/completions'))).toBe(true)
  })

  it('skips hidden models before applying maxModels so later visible models can be probed', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
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
        probe: { maxModels: 1, concurrency: 1, attempts: 1, timeoutMs: 10000 },
      }],
    }))

    let healthState: ModelHealthState = {}
    for (let index = 0; index < 5; index += 1) {
      healthState = recordModelFailure(healthState, 'provider-a', 'a-free-hidden', '2026-08-27T09:00:00.000Z')
    }
    await kv.put('model-health-state', JSON.stringify(healthState))

    const env = {
      RADAR_KV: kv as unknown as KVNamespace,
      PROVIDER_A_KEY: 'key',
    } satisfies RadarEnv

    const probedModels: string[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'a-free-hidden' }, { id: 'b-free-visible' }] }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body)) as { model: string }
      probedModels.push(body.model)
      return streamingProbeResponse()
    }

    await runRefresh(env, 'refresh-test', fetchImpl as typeof fetch)

    const latestResults = JSON.parse((await kv.get('latest-results')) ?? 'null')
    expect(probedModels).toEqual(['b-free-visible'])
    expect(latestResults.providers[0].models[0].id).toBe('b-free-visible')
    expect(latestResults.providers[0].models[0].tokenUsage.totalTokens).toBeNull()
  })

  it('probes all fallback models across multiple refresh batches', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
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
    }))

    const env = { RADAR_KV: kv as unknown as KVNamespace, PROVIDER_A_KEY: 'key' } satisfies RadarEnv
    const modelIds = Array.from({ length: 7 }, (_, index) => `paid-${index}`)
    const probedModels: string[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: modelIds.map((id) => ({ id })) }), { status: 200 })
      }
      probedModels.push((JSON.parse(String(init?.body)) as { model: string }).model)
      return streamingProbeResponse()
    }

    const refreshId = 'refresh-batched'
    await runRefresh(env, refreshId, fetchImpl as typeof fetch)
    let status = JSON.parse((await kv.get('latest-refresh-status')) ?? 'null')
    while (status.status === 'running') {
      await runRefresh(env, refreshId, fetchImpl as typeof fetch)
      status = JSON.parse((await kv.get('latest-refresh-status')) ?? 'null')
    }

    expect(status.status).toBe('success')
    expect(probedModels).toEqual(modelIds)
  })

  it('probes up to five models concurrently across providers', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [
        {
          id: 'provider-a',
          name: 'Provider A',
          baseUrl: 'https://api-a.example.com/v1',
          secretName: 'PROVIDER_A_KEY',
          enabled: true,
          modelStrategy: 'free-first',
          freeKeywords: ['free'],
          probe: { maxModels: 20, concurrency: 1, attempts: 1, timeoutMs: 10000 },
        },
        {
          id: 'provider-b',
          name: 'Provider B',
          baseUrl: 'https://api-b.example.com/v1',
          secretName: 'PROVIDER_B_KEY',
          enabled: true,
          modelStrategy: 'free-first',
          freeKeywords: ['free'],
          probe: { maxModels: 20, concurrency: 1, attempts: 1, timeoutMs: 10000 },
        },
      ],
    }))

    const env = {
      RADAR_KV: kv as unknown as KVNamespace,
      PROVIDER_A_KEY: 'key-a',
      PROVIDER_B_KEY: 'key-b',
    } satisfies RadarEnv

    const pendingProbeResolvers: Array<() => void> = []
    let resolveFiveStarted!: () => void
    const fiveStarted = new Promise<void>((resolve) => {
      resolveFiveStarted = resolve
    })
    const probedModels: string[] = []

    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/models')) {
        const prefix = url.includes('api-a') ? 'a' : 'b'
        return new Response(JSON.stringify({ data: Array.from({ length: 3 }, (_, index) => ({ id: `${prefix}-model-${index}` })) }), { status: 200 })
      }

      const model = (JSON.parse(String(init?.body)) as { model: string }).model
      probedModels.push(model)
      if (probedModels.length === 5) resolveFiveStarted()
      await new Promise<void>((resolve) => pendingProbeResolvers.push(resolve))
      return streamingProbeResponse()
    }

    const refreshPromise = runRefresh(env, 'refresh-parallel', fetchImpl as typeof fetch)
    await Promise.race([
      fiveStarted,
      new Promise((_, reject) => setTimeout(() => reject(new Error('five models were not probed concurrently')), 100)),
    ])
    for (const resolve of pendingProbeResolvers) resolve()
    await refreshPromise

    expect(probedModels.sort()).toEqual(['a-model-0', 'a-model-1', 'a-model-2', 'b-model-0', 'b-model-1'])
    expect(probedModels).not.toContain('b-model-2')
  })

  it('keeps successful model results when another model in the same batch times out', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
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
        probe: { maxModels: 20, concurrency: 5, attempts: 1, timeoutMs: 10 },
      }],
    }))

    const env = { RADAR_KV: kv as unknown as KVNamespace, PROVIDER_A_KEY: 'key' } satisfies RadarEnv
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'fast-a' }, { id: 'slow-timeout' }, { id: 'fast-b' }] }), { status: 200 })
      }

      const model = (JSON.parse(String(init?.body)) as { model: string }).model
      if (model === 'slow-timeout') {
        await new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
      }
      return streamingProbeResponse()
    }

    await runRefresh(env, 'refresh-timeout', fetchImpl as typeof fetch)

    const latestResults = JSON.parse((await kv.get('latest-results')) ?? 'null')
    expect(latestResults.providers[0].models.map((model: { id: string }) => model.id).sort()).toEqual(['fast-a', 'fast-b'])
  })

  it('accepts refresh when lock KV get keeps failing', async () => {
    const kv = new MemoryKV()
    kv.failGetKeys.add('refresh-lock')
    await kv.put('providers-config', JSON.stringify({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [],
    }))

    const env = { RADAR_KV: kv as unknown as KVNamespace } satisfies RadarEnv
    const sent: RefreshQueueMessage[] = []
    const mockQueue = {
      send: async (msg: RefreshQueueMessage) => { sent.push(msg) },
    } as unknown as Queue<RefreshQueueMessage>
    const result = await startRefresh(env, mockQueue)

    expect(result.accepted).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0].refreshId).toMatch(/^refresh-/)
    expect(sent[0].isNewRefresh).toBe(true)
  })

  it('marks successful fallback models as free', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
      version: 1,
      updatedAt: '2026-08-27T09:00:00.000Z',
      providers: [{
        id: 'b-ai',
        name: 'B.AI',
        baseUrl: 'https://api.b.ai/v1',
        secretName: 'BAI_API_KEY',
        enabled: true,
        modelStrategy: 'free-first',
        freeKeywords: ['free', ':free'],
        probe: { maxModels: 20, concurrency: 1, attempts: 1, timeoutMs: 10000 },
      }],
    }))

    const env = { RADAR_KV: kv as unknown as KVNamespace, BAI_API_KEY: 'key' } satisfies RadarEnv
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'glm-5.3-flash' }] }), { status: 200 })
      }
      expect((JSON.parse(String(init?.body)) as { model: string }).model).toBe('glm-5.3-flash')
      return streamingProbeResponse()
    }

    await runRefresh(env, 'refresh-test', fetchImpl as typeof fetch)

    const latestResults = JSON.parse((await kv.get('latest-results')) ?? 'null')
    expect(latestResults.providers[0].models[0].id).toBe('glm-5.3-flash')
    expect(latestResults.providers[0].models[0].freeStatus).toBe('free')
  })

  it('processRefreshMessage drives multiple batches through the queue until done', async () => {
    const kv = new MemoryKV()
    await kv.put('providers-config', JSON.stringify({
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
    }))

    const env = { RADAR_KV: kv as unknown as KVNamespace, PROVIDER_A_KEY: 'key' } satisfies RadarEnv
    // 12 个模型，MAX_MODELS_PER_INVOCATION=5 → 需要 3 批（5+5+2）
    const modelIds = Array.from({ length: 12 }, (_, i) => `model-${i + 1}`)
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: modelIds.map((id) => ({ id })) }), { status: 200 })
      }
      return streamingProbeResponse()
    }

    const sent: RefreshQueueMessage[] = []
    const mockQueue = {
      send: async (msg: RefreshQueueMessage) => { sent.push(msg) },
    } as unknown as Queue<RefreshQueueMessage>

    // 第一批（新任务）
    await processRefreshMessage(env, mockQueue, { refreshId: 'refresh-q', isNewRefresh: true }, fetchImpl as typeof fetch)

    // 依次消费后续批次，直到队列清空
    let guard = 0
    while (sent.length > 0 && guard < 20) {
      const msg = sent.shift()!
      await processRefreshMessage(env, mockQueue, msg, fetchImpl as typeof fetch)
      guard += 1
    }

    const status = JSON.parse((await kv.get('latest-refresh-status')) ?? 'null')
    expect(status.status).toBe('success')
    expect(status.progress.completed).toBe(12)
    expect(status.progress.total).toBe(12)

    // 完成后 job 应被删除，不再继续入队
    expect(await kv.get('refresh-job')).toBeNull()
    expect(sent).toHaveLength(0)
  })
})
