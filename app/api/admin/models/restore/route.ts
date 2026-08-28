import { NextResponse } from 'next/server'
import { isAdminSessionCookie } from '@/auth/admin-session'
import { getRadarEnv } from '@/lib/cloudflare'
import { getModelHealthState, putModelHealthState } from '@/storage/model-health-store'
import { restoreModel } from '@/services/model-health-service'


export async function POST(request: Request) {
  const env = await getRadarEnv()
  if (!(await isAdminSessionCookie(request.headers.get('cookie'), env.REFRESH_ADMIN_TOKEN))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { providerId?: unknown; modelId?: unknown }
  if (typeof body.providerId !== 'string' || typeof body.modelId !== 'string') {
    return NextResponse.json({ error: 'providerId and modelId are required' }, { status: 400 })
  }

  const state = await getModelHealthState(env.RADAR_KV)
  await putModelHealthState(env.RADAR_KV, restoreModel(state, body.providerId, body.modelId))
  return NextResponse.json({ status: 'restored' })
}
