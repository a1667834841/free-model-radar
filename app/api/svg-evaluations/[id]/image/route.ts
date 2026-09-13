import { getRadarEnv } from '@/lib/cloudflare'
import { getPublicSvgImage } from '@/services/svg-evaluation-service'
import { getRadarDatabase } from '@/domain/env'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params
  if (!/^\d+$/.test(rawId)) return new Response('Not found', { status: 404 })

  try {
    const env = await getRadarEnv()
    const svg = await getPublicSvgImage(getRadarDatabase(env), Number(rawId))
    if (!svg) return new Response('Not found', { status: 404 })
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'x-content-type-options': 'nosniff',
        'cross-origin-resource-policy': 'same-origin',
      },
    })
  } catch (error) {
    console.error(`[api:svg-evaluation-image:${rawId}] query failed`, error)
    return new Response('Temporarily unavailable', { status: 503 })
  }
}
