import { NextResponse } from 'next/server'
import { createAdminSessionCookie, isValidAdminToken } from '@/auth/admin-session'
import { getRadarEnv } from '@/lib/cloudflare'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const adminToken = url.searchParams.get('admin_token')
  const env = await getRadarEnv()

  const redirectUrl = new URL('/', url.origin)
  if (!isValidAdminToken(adminToken, env.REFRESH_ADMIN_TOKEN)) {
    return NextResponse.redirect(redirectUrl)
  }

  const response = NextResponse.redirect(redirectUrl)
  response.headers.append('set-cookie', await createAdminSessionCookie(env.REFRESH_ADMIN_TOKEN ?? '', { secure: url.protocol === 'https:' }))
  return response
}
