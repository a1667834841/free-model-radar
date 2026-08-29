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

/**
 * 厂商官网首页 URL 的显式映射。
 *
 * API baseUrl 去掉 /v1 并不总是等于官网首页：
 * - `api.*` / `token.*` / `router.*` 子域往往只是网关/API 端点，不是面向用户的官网；
 * - `openrouter.ai/api`、`opencode.ai/zen` 等是 API 或 Zen 子页，而非首页。
 * 因此这里显式声明，保证「厂商」跳转落到真正的官网。未映射的 provider 再回退到 baseUrl 推导。
 */
const PROVIDER_HOME_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai',
  bynara: 'https://router.bynara.id',
  sensenova: 'https://www.sensenova.cn',
  'b-ai': 'https://b.ai',
  tokenrouter: 'https://www.tokenrouter.com',
  tokenharbor: 'https://tokenharbor.ai',
  rntm: 'https://rntm.sh',
  aihubmix: 'https://aihubmix.com',
  opencode: 'https://opencode.ai',
}

export function normalizeProviderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type ProviderLike = Pick<ProviderResult, 'id' | 'baseUrl'> & Partial<Pick<ProviderResult, 'name'>>

/** provider → 厂商官网首页；优先显式映射，未映射时用 baseUrl 去 /v1 回退推导。 */
export function getProviderHomeUrl(provider?: ProviderLike): string | null {
  if (!provider) return null
  const explicit =
    PROVIDER_HOME_URLS[normalizeProviderKey(provider.id)] ??
    (provider.name ? PROVIDER_HOME_URLS[normalizeProviderKey(provider.name)] : undefined)
  if (explicit) return explicit
  if (!provider.baseUrl) return null
  return provider.baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

export function getProviderIconUrl(
  provider: Pick<ProviderResult, 'id' | 'name' | 'baseUrl'>,
  homeUrl: string | null = getProviderHomeUrl(provider),
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
