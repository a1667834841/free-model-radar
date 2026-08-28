import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { RadarEnv } from '@/domain/env'

export async function getRadarEnv(): Promise<RadarEnv> {
  const context = await getCloudflareContext({ async: true })
  return context.env as unknown as RadarEnv
}

export async function waitUntil(promise: Promise<unknown>): Promise<void> {
  const context = await getCloudflareContext({ async: true })
  context.ctx.waitUntil(promise)
}
