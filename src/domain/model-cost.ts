import type { DiscoveredModel } from './model'
import type { ProviderConfig } from './provider'

export type ModelCostType = 'free' | 'free-quota' | 'trial' | 'paid' | 'unknown'
export type ModelCost = {
  type: ModelCostType
  source: 'pricing' | 'catalog-flag' | 'config' | 'unknown'
  evidence: string
  checkedAt: string
}

function price(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function classifyModelCost(provider: ProviderConfig, model: DiscoveredModel, checkedAt = new Date().toISOString()): ModelCost {
  const result = (type: ModelCostType, source: ModelCost['source'], evidence: string): ModelCost => ({ type, source, evidence, checkedAt })
  const prompts = [model.pricing?.prompt, ...(model.pricings?.prompt ?? []).map((item) => item.value)].map(price)
  const completions = [model.pricing?.completion, ...(model.pricings?.completion ?? []).map((item) => item.value)].map(price)
  // 明确正价优先，避免名称、免费路由或人工配置覆盖收费证据。
  if ([...prompts, ...completions].some((value) => value !== null && value > 0)) {
    return result('paid', 'pricing', 'positive input or output price')
  }
  if (model.isFree === false || model.hasFreeRoute === false) {
    return result('unknown', 'catalog-flag', 'catalog explicitly denies free access')
  }
  if (prompts.includes(0) && completions.includes(0)) {
    return result('free', 'pricing', 'input and output prices are zero')
  }
  if (model.isFree === true) return result('free-quota', 'catalog-flag', 'is_free=true; account limits may apply')
  // 有免费路由不代表当前请求会被路由到免费端点。
  const configured = provider.billing?.models?.[model.id] ?? provider.billing?.defaultType
  if (configured) return result(configured, 'config', provider.billing!.source)
  return result('unknown', 'unknown', model.hasFreeRoute === true ? 'free route exists; request route unverified' : 'no billing evidence')
}

export function isFreeCost(type: ModelCostType): boolean {
  return type === 'free' || type === 'free-quota'
}
