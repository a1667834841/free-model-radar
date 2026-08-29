import type { ProviderResult } from '@/domain/result'

/**
 * Provider 图标/主页 URL 推导（原 dashboard.tsx 与 model-evaluation.tsx 各有一份，此处收拢）。
 */

/** 已知 provider id/name → favicon 域名（或含路径的完整 favicon URL）的显式映射。 */
const PROVIDER_ICON_DOMAINS: Record<string, string> = {
  bai: 'chat.b.ai/favicon.ico',
  'b-ai': 'chat.b.ai/favicon.ico',
  openrouter: 'openrouter.ai/favicon.ico',
  sensenova: 'www.sensenova.cn/favicon.ico',
  aihubmix: 'aihubmix.com/favicon.ico',
  bynara: 'router.bynara.id',
  opencode: 'opencode.ai',
  tokenharbor: 'tokenharbor.ai',
  tokenrouter: 'tokenrouter.com',
  rntm: 'rntm.sh',
}

export function normalizeProviderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** baseUrl → 厂商官网首页（去尾斜杠与 /v1 后缀）。 */
export function getProviderHomeUrl(baseUrl?: string): string | null {
  if (!baseUrl) return null
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

export function getProviderIconUrl(
  provider: Pick<ProviderResult, 'id' | 'name' | 'baseUrl'>,
  homeUrl: string | null = getProviderHomeUrl(provider.baseUrl),
): string | null {
  const explicitDomain =
    PROVIDER_ICON_DOMAINS[normalizeProviderKey(provider.id)] ??
    PROVIDER_ICON_DOMAINS[normalizeProviderKey(provider.name)]
  if (explicitDomain) {
    if (explicitDomain.includes('/')) return `https://${explicitDomain}`
    return `https://www.google.com/s2/favicons?sz=64&domain=${explicitDomain}`
  }
  if (!homeUrl) return null
  try {
    const { hostname } = new URL(homeUrl)
    const displayHost = hostname.replace(/^(api|token|router)\./, '')
    return `https://www.google.com/s2/favicons?sz=64&domain=${displayHost}`
  } catch {
    return null
  }
}
