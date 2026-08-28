import { NextResponse } from 'next/server'
import { getLatestResults } from '@/storage/results-store'
import { getRadarEnv } from '@/lib/cloudflare'


const STALE_AFTER_MS = 60 * 60 * 1000

export async function GET() {
  const env = await getRadarEnv()
  const results = await getLatestResults(env.RADAR_KV)
  if (!results) {
    return NextResponse.json({ updatedAt: null, isStale: true, refreshId: null, providers: [] })
  }

  return NextResponse.json({
    ...results,
    isStale: Date.now() - new Date(results.updatedAt).getTime() > STALE_AFTER_MS,
  })
}
