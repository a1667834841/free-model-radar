import { NextResponse } from 'next/server'
import { getRadarEnv } from '@/lib/cloudflare'
import { getRadarDatabase } from '@/domain/env'
import { getTrendResponse } from '@/storage/trend-store'

export async function GET() {
  const env = await getRadarEnv()
  const trends = await getTrendResponse(env.RADAR_KV, undefined, getRadarDatabase(env))
  return NextResponse.json(trends)
}
