import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const adminToken = request.nextUrl.searchParams.get('admin_token')
  if (!adminToken) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/api/admin/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('admin_token', adminToken)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: '/',
}
