import type { RadarEnv } from '@/domain/env'
import type { ProviderConfig, ProviderConfigDocument } from '@/domain/provider'
import type { ResultsSnapshot } from '@/domain/result'
import { supportsAutoModelCapabilities } from '@/domain/model-capabilities'
import { getProviderConfig } from '@/storage/provider-config-store'
import { getLatestResults } from '@/storage/results-store'

const PROVIDER_HEADER = 'X-Provider-Id'
const SELECTED_PROVIDER_HEADER = 'X-Selected-Provider'
const SELECTED_MODEL_HEADER = 'X-Selected-Model'

type JsonObject = Record<string, unknown>

export type AutoTarget = {
  provider: ProviderConfig
  modelId: string
  ttftMs: number
  tokensPerSec: number | null
  latencyMs: number
}

export function isOpenAiGatewayPath(pathname: string): boolean {
  return pathname === '/v1' || pathname.startsWith('/v1/')
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': `Authorization, Content-Type, ${PROVIDER_HEADER}, OpenAI-Beta`,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': `${SELECTED_PROVIDER_HEADER}, ${SELECTED_MODEL_HEADER}`,
  }
}

function errorResponse(status: number, message: string, code: string): Response {
  return Response.json({
    error: {
      message,
      type: status === 401 ? 'authentication_error' : 'invalid_request_error',
      param: null,
      code,
    },
  }, {
    status,
    headers: {
      ...corsHeaders(),
      'Cache-Control': 'no-store',
    },
  })
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'))
}

function isOpenAiProvider(provider: ProviderConfig): boolean {
  return provider.enabled && provider.apiStyle !== 'cloudflare-workers-ai'
}

function hasProviderSecret(env: RadarEnv, provider: ProviderConfig): boolean {
  const value = env[provider.secretName]
  return typeof value === 'string' && value.length > 0
}

export function rankAutoTargets(
  config: ProviderConfigDocument,
  snapshot: ResultsSnapshot,
): AutoTarget[] {
  const providerById = new Map(
    config.providers.filter(isOpenAiProvider).map((provider) => [provider.id, provider]),
  )

  return snapshot.providers
    .filter((result) => result.status === 'healthy')
    .flatMap((result) => {
      const provider = providerById.get(result.id)
      if (!provider) return []
      return result.models.flatMap((model) => {
        if (!supportsAutoModelCapabilities({ ...model, providerName: result.name })) return []
        const ttftMs = model.ttftMs ?? model.latencyMs
        if (!Number.isFinite(ttftMs) || !Number.isFinite(model.latencyMs)) return []
        return [{
          provider,
          modelId: model.id,
          ttftMs,
          tokensPerSec: model.tokensPerSec ?? null,
          latencyMs: model.latencyMs,
        }]
      })
    })
    .sort((a, b) => {
      if (a.ttftMs !== b.ttftMs) return a.ttftMs - b.ttftMs
      const tpsA = a.tokensPerSec ?? -Infinity
      const tpsB = b.tokensPerSec ?? -Infinity
      if (tpsA !== tpsB) return tpsB - tpsA
      if (a.latencyMs !== b.latencyMs) return a.latencyMs - b.latencyMs
      const providerCompare = a.provider.id.localeCompare(b.provider.id)
      return providerCompare !== 0 ? providerCompare : a.modelId.localeCompare(b.modelId)
    })
}

export function findProvidersForModel(
  config: ProviderConfigDocument,
  snapshot: ResultsSnapshot,
  modelId: string,
): ProviderConfig[] {
  const healthyProviders = new Map(
    snapshot.providers
      .filter((provider) => provider.status === 'healthy')
      .map((provider) => [provider.id, provider]),
  )

  // Provider 配置顺序是默认路由优先级；同名模型命中多个厂商时取排在前面的厂商。
  return config.providers.filter((provider) => {
    if (!isOpenAiProvider(provider)) return false
    return healthyProviders.get(provider.id)?.models.some((model) => model.id === modelId) === true
  })
}

function upstreamUrl(provider: ProviderConfig, incomingUrl: URL): URL {
  const baseUrl = provider.baseUrl.replace(/\/$/, '')
  const suffix = incomingUrl.pathname.slice('/v1'.length)
  return new URL(`${baseUrl}${suffix}${incomingUrl.search}`)
}

function upstreamHeaders(request: Request, apiKey: string): Headers {
  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${apiKey}`)
  headers.set('Cache-Control', 'no-cache')
  headers.delete(PROVIDER_HEADER)
  headers.delete('Host')
  headers.delete('Content-Length')
  headers.delete('Connection')
  headers.delete('CF-Connecting-IP')
  headers.delete('CF-Ray')
  headers.delete('X-Forwarded-For')
  headers.delete('X-Real-IP')
  return headers
}

function gatewayResponse(upstream: Response, providerId: string, modelId: string | null): Response {
  const headers = new Headers(upstream.headers)
  headers.set(SELECTED_PROVIDER_HEADER, providerId)
  if (modelId) headers.set(SELECTED_MODEL_HEADER, modelId)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Expose-Headers', `${SELECTED_PROVIDER_HEADER}, ${SELECTED_MODEL_HEADER}`)
  headers.set('Cache-Control', 'no-store')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}

export async function handleOpenAiGateway(
  request: Request,
  env: RadarEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  const gatewayKey = env.GATEWAY_API_KEY
  if (typeof gatewayKey !== 'string' || gatewayKey.length === 0) {
    return errorResponse(503, 'Gateway is not configured', 'gateway_not_configured')
  }
  if (request.headers.get('Authorization') !== `Bearer ${gatewayKey}`) {
    return errorResponse(401, 'Invalid gateway key', 'invalid_api_key')
  }

  let body: BodyInit | null | undefined = request.body
  let payload: JsonObject | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD' && isJsonContentType(request.headers.get('Content-Type'))) {
    const rawBody = await request.text()
    body = rawBody
    if (rawBody.trim()) {
      try {
        const parsed = JSON.parse(rawBody) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return errorResponse(400, 'Request body must be a JSON object', 'invalid_json')
        }
        payload = parsed as JsonObject
      } catch {
        return errorResponse(400, 'Request body is not valid JSON', 'invalid_json')
      }
    }
  }

  let config: ProviderConfigDocument
  try {
    config = await getProviderConfig(env.RADAR_KV)
  } catch {
    return errorResponse(503, 'Provider configuration is unavailable', 'provider_config_unavailable')
  }

  const requestedModel = typeof payload?.model === 'string' ? payload.model : null
  let provider: ProviderConfig | undefined
  let selectedModel = requestedModel

  if (requestedModel === 'auto') {
    if (!payload) {
      return errorResponse(400, 'Request body must be a JSON object', 'invalid_json')
    }
    let snapshot: ResultsSnapshot | null
    try {
      snapshot = await getLatestResults(env.RADAR_KV)
    } catch {
      return errorResponse(503, 'Automatic model selection is unavailable', 'auto_unavailable')
    }

    const target = snapshot
      ? rankAutoTargets(config, snapshot).find((candidate) => hasProviderSecret(env, candidate.provider))
      : undefined
    if (!target) {
      return errorResponse(503, 'No healthy automatic model is available', 'no_auto_model')
    }

    provider = target.provider
    selectedModel = target.modelId
    payload.model = target.modelId
    payload.enable_thinking = true
    body = JSON.stringify(payload)
  } else {
    const providerId = request.headers.get(PROVIDER_HEADER)?.trim()
    if (providerId) {
      provider = config.providers.find((candidate) => candidate.id === providerId && isOpenAiProvider(candidate))
      if (!provider) {
        return errorResponse(400, `Unknown or disabled provider: ${providerId}`, 'invalid_provider')
      }
      if (!hasProviderSecret(env, provider)) {
        return errorResponse(503, `Provider is not configured: ${providerId}`, 'provider_not_configured')
      }
    } else {
      if (!requestedModel) {
        return errorResponse(400, `A model or ${PROVIDER_HEADER} header is required`, 'model_or_provider_required')
      }
      let snapshot: ResultsSnapshot | null
      try {
        snapshot = await getLatestResults(env.RADAR_KV)
      } catch {
        return errorResponse(503, 'Model routing data is unavailable', 'model_routing_unavailable')
      }
      if (!snapshot) {
        return errorResponse(503, 'Model routing data is unavailable', 'model_routing_unavailable')
      }

      const matchingProviders = findProvidersForModel(config, snapshot, requestedModel)
      provider = matchingProviders.find((candidate) => hasProviderSecret(env, candidate))
      if (!provider) {
        const status = matchingProviders.length > 0 ? 503 : 400
        const code = matchingProviders.length > 0 ? 'model_provider_not_configured' : 'model_provider_not_found'
        return errorResponse(status, `No available provider found for model: ${requestedModel}`, code)
      }
    }
  }

  const apiKey = env[provider.secretName] as string
  let upstream: Response
  try {
    upstream = await fetchImpl(upstreamUrl(provider, new URL(request.url)), {
      method: request.method,
      headers: upstreamHeaders(request, apiKey),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
      redirect: 'manual',
    })
  } catch {
    return errorResponse(502, 'Upstream provider request failed', 'upstream_request_failed')
  }

  return gatewayResponse(upstream, provider.id, selectedModel)
}
