import { getLatestResults } from '@/storage/results-store'
import { getRadarEnv } from '@/lib/cloudflare'
import { createProviderStatusSvgResponse, renderProviderStatusSvg } from '@/lib/provider-status-svg'

export async function GET() {
  const env = await getRadarEnv()
  const results = await getLatestResults(env.RADAR_KV)

  return createProviderStatusSvgResponse(renderProviderStatusSvg(results, true))
}
