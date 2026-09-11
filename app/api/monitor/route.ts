import { NextResponse } from 'next/server'
import { getRadarEnv } from '@/lib/cloudflare'
import { monitorRefreshHealth } from '@/services/refresh-monitor'

export async function GET(request: Request) {
  const env = await getRadarEnv()
  const expected = env.MONITOR_TOKEN
  const authorization = request.headers.get('authorization')
  if (typeof expected !== 'string' || expected.length === 0 || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await monitorRefreshHealth(env)
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
