import { NextResponse } from 'next/server'
import { isAdminSessionCookie } from '@/auth/admin-session'
import { getRadarEnv } from '@/lib/cloudflare'
import { startRefresh } from '@/services/refresh-service'
import type { RefreshQueueMessage } from '@/domain/refresh'


export async function POST(request: Request) {
  const env = await getRadarEnv()
  if (!(await isAdminSessionCookie(request.headers.get('cookie'), env.REFRESH_ADMIN_TOKEN))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const queue = env.REFRESH_QUEUE as Queue<RefreshQueueMessage>
  const result = await startRefresh(env, queue)
  if (!result.accepted) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ status: 'accepted', refreshId: result.refreshId }, { status: 202 })
}
