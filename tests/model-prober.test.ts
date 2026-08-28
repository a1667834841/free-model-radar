import { describe, expect, it } from 'vitest'
import { probeModel, modelProberInternals, buildProbePrompt } from '@/services/model-prober'
import type { ProviderConfig } from '@/domain/provider'

const provider: ProviderConfig = {
  id: 'provider-a',
  name: 'Provider A',
  baseUrl: 'https://api.example.com/v1',
  secretName: 'PROVIDER_A_KEY',
  enabled: true,
  modelStrategy: 'free-first',
  freeKeywords: ['free', ':free'],
  probe: { maxModels: 20, concurrency: 3, attempts: 1, timeoutMs: 10000 },
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

describe('model prober', () => {
  it('builds a non-cacheable prompt with a different seed each time', () => {
    const a = buildProbePrompt()
    const b = buildProbePrompt()
    expect(a).toMatch(/^Reply with exactly: pong  \[seed:[0-9a-f]{16}\]$/)
    expect(a).not.toBe(b)
  })

  it('allows an explicit seed for deterministic tests', () => {
    expect(buildProbePrompt('abc123')).toContain('[seed:abc123]')
  })

  it('accepts streaming HTTP 200 with assistant content and usage', async () => {
    const fetchImpl = async () => sseResponse([
      'data: {"choices":[{"delta":{"content":"po"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"ng"}}],"usage":{"prompt_tokens":12,"completion_tokens":8,"total_tokens":20}}\n\n',
      'data: [DONE]\n\n',
    ])

    const result = await probeModel(provider, 'key', 'qwen:free', fetchImpl as typeof fetch)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.content).toBe('pong')
      expect(result.freeStatus).toBe('free')
      expect(result.tokenUsage.totalTokens).toBe(20)
      expect(result.ttftMs).toBeGreaterThanOrEqual(0)
      expect(result.tokensPerSec).not.toBeNull()
    }
  })

  it('marks a successful fallback model as free even when its name has no free keyword', async () => {
    const fetchImpl = async () => sseResponse([
      'data: {"choices":[{"delta":{"content":"pong"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const result = await probeModel(provider, 'key', 'glm-5.3-flash', fetchImpl as typeof fetch)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.freeStatus).toBe('free')
    }
  })

  it('rejects streaming HTTP 200 without valid assistant content', async () => {
    const fetchImpl = async () => sseResponse([
      'data: {"choices":[{"delta":{"content":""}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const result = await probeModel(provider, 'key', 'model-a', fetchImpl as typeof fetch)

    expect(result.ok).toBe(false)
  })

  it('rejects non-200 responses', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    const result = await probeModel(provider, 'key', 'model-a', fetchImpl as typeof fetch)

    expect(result.ok).toBe(false)
  })

  it('rejects HTTP 200 responses whose content is a platform availability notice', async () => {
    const notice = [
      'data: {"choices":[{"delta":{"content":"Sorry, to prevent abuse of free resources, accounts that have not"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" been recharged can only try 10 times. You can increase the free quota after recharging"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const fetchImpl = async () => sseResponse(notice)
    const result = await probeModel(provider, 'key', 'coding-minimax-m3-free', fetchImpl as typeof fetch)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/model unavailable/i)
    }
  })

  it('matches platform availability notice keywords', () => {
    expect(
      modelProberInternals.findUnavailableContentPhrase(
        'Sorry, to prevent abuse of free resources, accounts that have not been recharged can only try 10 times.',
      ),
    ).toMatch(/abuse of free resources/)
    expect(modelProberInternals.findUnavailableContentPhrase('pong  [seed:abc123]')).toBeNull()
  })

  it('estimates tokens per second when usage is missing', () => {
    const tps = modelProberInternals.computeTokensPerSec(1000, 200, null, 'pong reply')
    expect(tps).toBeGreaterThan(0)
  })
})
