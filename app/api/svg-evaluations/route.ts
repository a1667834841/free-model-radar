import { NextResponse } from 'next/server'
import { getRadarEnv } from '@/lib/cloudflare'
import { getPublicSvgEvaluations } from '@/services/svg-evaluation-service'
import { safeErrorMessage } from '@/lib/json'
import { getRadarDatabase } from '@/domain/env'

export async function GET() {
  try {
    const env = await getRadarEnv()
    return NextResponse.json(await getPublicSvgEvaluations(getRadarDatabase(env)), {
      headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('[api:svg-evaluations] query failed', error)
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 503 })
  }
}
