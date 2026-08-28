import { NextResponse } from 'next/server'
import { isAdminSessionCookie } from '@/auth/admin-session'
import { getRadarEnv } from '@/lib/cloudflare'
import { getRefreshStatusOrTransient } from '@/storage/results-store'


export async function GET(request: Request) {
  const env = await getRadarEnv()
  if (!(await isAdminSessionCookie(request.headers.get('cookie'), env.REFRESH_ADMIN_TOKEN))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await getRefreshStatusOrTransient(env.RADAR_KV))
}
