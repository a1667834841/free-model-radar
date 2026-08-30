import { cookies, headers } from 'next/headers'
import { isAdminSessionCookie } from '@/auth/admin-session'
import { getRadarEnv } from '@/lib/cloudflare'
import { getLatestResults, getRefreshStatus } from '@/storage/results-store'
import { flattenProviderResults } from '@/domain/result'
import { LanguageProvider } from './i18n'
import Dashboard from './dashboard'

const STALE_AFTER_MS = 60 * 60 * 1000

function decodeCity(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export default async function Page() {
  const env = await getRadarEnv()
  const cookieStore = await cookies()
  const headerStore = await headers()
  const isAdmin = await isAdminSessionCookie(cookieStore.toString(), env.REFRESH_ADMIN_TOKEN)
  const [results, refreshStatus] = await Promise.all([
    getLatestResults(env.RADAR_KV),
    getRefreshStatus(env.RADAR_KV),
  ])

  // 当前访问请求经过的 Cloudflare 边缘节点地区（OpenNext 从 request.cf 注入）
  const rawCity = headerStore.get('x-open-next-city')
  const nodeGeo = {
    city: rawCity ? decodeCity(rawCity) : null,
    country: headerStore.get('x-open-next-country') ?? null,
    region: headerStore.get('x-open-next-region') ?? null,
  }

  const updatedAt = results?.updatedAt ? new Date(results.updatedAt).toISOString() : null
  const isStale = updatedAt ? Date.now() - new Date(updatedAt).getTime() > STALE_AFTER_MS : true
  const models = results ? flattenProviderResults(results.providers) : []
  const providers = results?.providers ?? []

  return (
    <LanguageProvider>
      <Dashboard
        providers={providers}
        models={models}
        updatedAt={updatedAt}
        isStale={isStale}
        refreshStatus={refreshStatus}
        trends={null}
        isAdmin={isAdmin}
        nodeGeo={nodeGeo}
      />
    </LanguageProvider>
  )
}
