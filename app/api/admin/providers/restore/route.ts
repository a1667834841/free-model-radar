import { NextResponse } from 'next/server'
import { isAdminSessionCookie } from '@/auth/admin-session'
import { getRadarEnv } from '@/lib/cloudflare'
import { restoreProvider } from '@/services/model-health-service'
import { getModelHealthState, putModelHealthState } from '@/storage/model-health-store'
import { acquireRefreshLock, releaseRefreshLock } from '@/storage/refresh-lock'

export async function POST(request: Request) {
  const env = await getRadarEnv()
  if (!(await isAdminSessionCookie(request.headers.get('cookie'), env.REFRESH_ADMIN_TOKEN))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { providerId?: unknown }
  if (typeof body.providerId !== 'string' || !body.providerId.trim()) {
    return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
  }

  const restoreId = `restore-provider-${body.providerId}-${crypto.randomUUID()}`
  const locked = await acquireRefreshLock(env.RADAR_KV, restoreId)
  if (!locked) {
    return NextResponse.json({ error: 'A refresh batch is running; retry after it finishes' }, { status: 409 })
  }

  try {
    const state = await getModelHealthState(env.RADAR_KV)
    const result = restoreProvider(state, body.providerId)
    await putModelHealthState(env.RADAR_KV, result.state)

    return NextResponse.json({ status: 'restored', providerId: body.providerId, restoredCount: result.restoredCount })
  } finally {
    await releaseRefreshLock(env.RADAR_KV, restoreId)
  }
}
