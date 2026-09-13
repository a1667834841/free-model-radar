import type { ProviderConfig } from '@/domain/provider'
import { SVG_EVALUATION_PROMPT } from '@/domain/svg-evaluation'
import { readJsonResponse, safeErrorMessage } from '@/lib/json'
import { withTimeout } from '@/lib/timeout'

const SVG_GENERATION_TIMEOUT_MS = 600_000
const MAX_RAW_RESPONSE_CHARS = 512 * 1024

type TokenCounts = { promptTokens: number | null; completionTokens: number | null }

export type SvgGenerationResult =
  | ({ ok: true; rawResponse: string; durationMs: number } & TokenCounts)
  | ({ ok: false; error: string; httpStatus: number | null; durationMs: number; rawResponse: string | null } & TokenCounts)

function extractOpenAiPayload(payload: unknown): { content: string | null } & TokenCounts {
  if (!payload || typeof payload !== 'object') return { content: null, promptTokens: null, completionTokens: null }
  const root = payload as { choices?: unknown; usage?: unknown }
  const first = Array.isArray(root.choices) ? root.choices[0] : null
  const message = first && typeof first === 'object' ? (first as { message?: unknown }).message : null
  const content = message && typeof message === 'object' ? (message as { content?: unknown }).content : null
  const usage = root.usage && typeof root.usage === 'object'
    ? root.usage as { prompt_tokens?: unknown; completion_tokens?: unknown }
    : null
  return {
    content: typeof content === 'string' && content.trim() ? content : null,
    promptTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    completionTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
  }
}

function extractCloudflarePayload(payload: unknown): { content: string | null } & TokenCounts {
  if (!payload || typeof payload !== 'object') return { content: null, promptTokens: null, completionTokens: null }
  const root = payload as { result?: unknown }
  const result = root.result
  const content = typeof result === 'string'
    ? result
    : result && typeof result === 'object' && typeof (result as { response?: unknown }).response === 'string'
      ? (result as { response: string }).response
      : null
  const usage = result && typeof result === 'object' && (result as { usage?: unknown }).usage && typeof (result as { usage: unknown }).usage === 'object'
    ? (result as { usage: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage
    : null
  return {
    content: content?.trim() ? content : null,
    promptTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    completionTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
  }
}

async function readErrorBody(response: Response): Promise<string | null> {
  try {
    const text = await response.text()
    return text ? text.slice(0, 2000) : null
  } catch {
    return null
  }
}

export async function generateSvg(
  provider: ProviderConfig,
  apiKey: string,
  modelId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SvgGenerationResult> {
  const startedAt = Date.now()
  try {
    return await withTimeout(async (signal) => {
      const isCloudflare = provider.apiStyle === 'cloudflare-workers-ai'
      if (isCloudflare && !provider.accountId) throw new Error('Cloudflare Workers AI provider requires accountId')
      const url = isCloudflare
        ? `${provider.baseUrl.replace(/\/$/, '')}/accounts/${provider.accountId}/ai/run/${encodeURI(modelId)}`
        : `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`
      const body = isCloudflare
        ? { messages: [{ role: 'user', content: SVG_EVALUATION_PROMPT }] }
        : { model: modelId, messages: [{ role: 'user', content: SVG_EVALUATION_PROMPT }], temperature: 0, stream: false }
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      if (response.status !== 200) {
        return {
          ok: false as const,
          error: `SVG generation failed with HTTP ${response.status}`,
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          rawResponse: await readErrorBody(response),
          promptTokens: null,
          completionTokens: null,
        }
      }
      const parsed = isCloudflare
        ? extractCloudflarePayload(await readJsonResponse(response))
        : extractOpenAiPayload(await readJsonResponse(response))
      if (!parsed.content) {
        return { ok: false as const, error: '模型未返回文本内容', httpStatus: null, durationMs: Date.now() - startedAt, rawResponse: null, ...parsed }
      }
      return {
        ok: true as const,
        rawResponse: parsed.content.slice(0, MAX_RAW_RESPONSE_CHARS),
        durationMs: Date.now() - startedAt,
        promptTokens: parsed.promptTokens,
        completionTokens: parsed.completionTokens,
      }
    }, SVG_GENERATION_TIMEOUT_MS)
  } catch (error) {
    return {
      ok: false,
      error: safeErrorMessage(error),
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      rawResponse: null,
      promptTokens: null,
      completionTokens: null,
    }
  }
}

export const svgGeneratorInternals = {
  extractOpenAiPayload,
  extractCloudflarePayload,
  SVG_GENERATION_TIMEOUT_MS,
}
