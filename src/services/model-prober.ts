import type { ProviderConfig } from '@/domain/provider'
import type { TokenUsage } from '@/domain/result'
import { estimateTokensFromContent } from '@/domain/evaluation'

import { readJsonResponse, safeErrorMessage } from '@/lib/json'
import { withTimeout } from '@/lib/timeout'

export type ProbeSuccess = {
  ok: true
  modelId: string
  latencyMs: number
  ttftMs: number
  tokensPerSec: number | null
  freeStatus: 'free' | 'available'
  prompt: string
  content: string | null
  tokenUsage: TokenUsage
  checkedAt: string
}

export type ProbeFailure = {
  ok: false
  modelId: string
  error: string
  checkedAt: string
}

export type ProbeResult = ProbeSuccess | ProbeFailure

const PROBE_PROMPT = 'Reply with exactly: pong'
const MAX_PROBE_TIMEOUT_MS = 25_000

function extractAssistantContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!first || typeof first !== 'object') return null
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') return null
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' && content.trim().length > 0 ? content : null
}

function extractTokenUsage(payload: unknown): TokenUsage {
  const empty = { promptTokens: null, completionTokens: null, totalTokens: null }
  if (!payload || typeof payload !== 'object') return empty
  const usage = (payload as { usage?: unknown }).usage
  if (!usage || typeof usage !== 'object') return empty
  const promptTokens = (usage as { prompt_tokens?: unknown }).prompt_tokens
  const completionTokens = (usage as { completion_tokens?: unknown }).completion_tokens
  const totalTokens = (usage as { total_tokens?: unknown }).total_tokens
  return {
    promptTokens: typeof promptTokens === 'number' ? promptTokens : null,
    completionTokens: typeof completionTokens === 'number' ? completionTokens : null,
    totalTokens: typeof totalTokens === 'number' ? totalTokens : null,
  }
}

function parseSseChunk(line: string): unknown | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function extractDeltaContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!first || typeof first !== 'object') return null
  const delta = (first as { delta?: unknown }).delta
  if (!delta || typeof delta !== 'object') return null
  const content = (delta as { content?: unknown }).content
  return typeof content === 'string' && content.length > 0 ? content : null
}

function computeTokensPerSec(
  latencyMs: number,
  ttftMs: number,
  completionTokens: number | null,
  content: string | null,
): number | null {
  const tokens = completionTokens ?? estimateTokensFromContent(content)
  if (tokens == null) return null
  const generationMs = Math.max(latencyMs - ttftMs, 1)
  return tokens / (generationMs / 1000)
}

async function readStreamingProbe(
  response: Response,
  startedAt: number,
): Promise<{ content: string; ttftMs: number; latencyMs: number; tokenUsage: TokenUsage }> {
  if (!response.body) {
    throw new Error('Streaming probe response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let ttftMs: number | null = null
  let tokenUsage: TokenUsage = { promptTokens: null, completionTokens: null, totalTokens: null }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      const payload = parseSseChunk(line)
      if (payload) {
        const usage = extractTokenUsage(payload)
        if (usage.totalTokens != null || usage.completionTokens != null) {
          tokenUsage = usage
        }
        const delta = extractDeltaContent(payload)
        if (delta) {
          if (ttftMs === null) ttftMs = Date.now() - startedAt
          content += delta
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const latencyMs = Date.now() - startedAt
  return {
    content,
    ttftMs: ttftMs ?? latencyMs,
    latencyMs,
    tokenUsage,
  }
}

async function probeOnce(provider: ProviderConfig, apiKey: string, modelId: string, fetchImpl: typeof fetch): Promise<ProbeSuccess> {
  const startedAt = Date.now()
  const { content, ttftMs, latencyMs, tokenUsage } = await withTimeout(async (signal) => {
    const response = await fetchImpl(provider.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: PROBE_PROMPT }],
        temperature: 0,
        max_tokens: 256,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    })

    if (response.status !== 200) {
      console.log(`[probe:${provider.id}/${modelId}] HTTP ${response.status} after ${Date.now() - startedAt}ms`)
      throw new Error(`Probe failed with HTTP ${response.status}`)
    }

    return readStreamingProbe(response, startedAt)
  }, Math.min(provider.probe.timeoutMs, MAX_PROBE_TIMEOUT_MS))

  if (!content.trim()) {
    throw new Error('Probe response does not contain valid assistant content')
  }

  const tokensPerSec = computeTokensPerSec(latencyMs, ttftMs, tokenUsage.completionTokens, content)

  return {
    ok: true,
    modelId,
    latencyMs,
    ttftMs,
    tokensPerSec,
    prompt: PROBE_PROMPT,
    content,
    freeStatus: 'free',
    tokenUsage,
    checkedAt: new Date().toISOString(),
  }
}

export async function probeModel(provider: ProviderConfig, apiKey: string, modelId: string, fetchImpl: typeof fetch = fetch): Promise<ProbeResult> {
  let lastError = 'Unknown probe error'
  for (let attempt = 0; attempt < provider.probe.attempts; attempt += 1) {
    try {
      return await probeOnce(provider, apiKey, modelId, fetchImpl)
    } catch (error) {
      lastError = safeErrorMessage(error)
    }
  }

  return {
    ok: false,
    modelId,
    error: lastError,
    checkedAt: new Date().toISOString(),
  }
}

export const modelProberInternals = {
  extractAssistantContent,
  extractTokenUsage,
  extractDeltaContent,
  computeTokensPerSec,
  readStreamingProbe,
}
