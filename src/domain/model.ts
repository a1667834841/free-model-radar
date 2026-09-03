import type { ProviderConfig } from './provider'

export type ModelPricing = {
  prompt?: string | number | null
  completion?: string | number | null
}

export type DiscoveredModel = {
  id: string
  pricing?: ModelPricing | null
  /** 部分平台（如 zenmux）使用数组形式的 pricings 字段，保留原始结构供厂商专用判定。 */
  pricings?: Record<string, Array<{ value?: unknown; unit?: unknown; currency?: unknown }>> | null
  hasFreeRoute?: boolean | null
  isFree?: boolean | null
  task?: string | null
}

const FALLBACK_ALL_MODEL_LIMIT = 20

export function isFreeModel(modelId: string, freeKeywords: string[]): boolean {
  const normalizedModelId = modelId.toLowerCase()
  return freeKeywords.some((keyword) => normalizedModelId.includes(keyword.toLowerCase()))
}

function isZeroPrice(value: string | number | null | undefined): boolean {
  if (typeof value === 'number') return value === 0
  if (typeof value === 'string') return Number(value) === 0
  return false
}

function hasProviderSpecificFreeSignal(provider: ProviderConfig): boolean {
  return provider.id === 'openrouter' || provider.id === 'rntm' || provider.id === 'gmicloud' || provider.id === 'zenmux' || provider.id === 'nvidia' || provider.id === 'cloudflare-workers-ai'
}

function getFirstPricingValue(list: Array<{ value?: unknown; unit?: unknown; currency?: unknown }> | undefined): number | null {
  if (!list || list.length === 0) return null
  const first = list[0]?.value
  return typeof first === 'number' ? first : null
}

function isZenmuxFreeModel(model: DiscoveredModel): boolean {
  const pricings = model.pricings
  if (!pricings) return false
  const completion = getFirstPricingValue(pricings.completion)
  const prompt = getFirstPricingValue(pricings.prompt)
  // zenmux 对个别模型只标 completion、无 prompt 价格，此时仍按付费处理，避免误判。
  return completion === 0 && prompt === 0
}

function isProviderSpecificFreeModel(provider: ProviderConfig, model: DiscoveredModel): boolean {
  switch (provider.id) {
    case 'openrouter':
      return isZeroPrice(model.pricing?.prompt) && isZeroPrice(model.pricing?.completion)
    case 'rntm':
      return model.hasFreeRoute === true
    case 'gmicloud':
      return model.isFree === true
    case 'zenmux':
      return isZenmuxFreeModel(model)
    case 'cloudflare-workers-ai':
      return model.id.startsWith('@cf/') && (!model.task || /text-generation|text generation|chat|conversational/i.test(model.task))
    default:
      return false
  }
}

function isCandidateFreeModel(provider: ProviderConfig, model: DiscoveredModel): boolean {
  if (provider.id === 'cloudflare-workers-ai') return isProviderSpecificFreeModel(provider, model)
  return isProviderSpecificFreeModel(provider, model) || isFreeModel(model.id, provider.freeKeywords)
}

export function selectModelsForProbe(provider: ProviderConfig, models: DiscoveredModel[]): DiscoveredModel[] {
  const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id))
  const freeModels = sortedModels.filter((model) => isCandidateFreeModel(provider, model))
  if (freeModels.length > 0) {
    return freeModels.slice(0, provider.probe.maxModels)
  }

  // OpenRouter/RNTM 有结构化免费标记；没有到期 free 候选时不要回退扫几百个付费模型。
  if (hasProviderSpecificFreeSignal(provider)) {
    return []
  }

  // 小模型集仍然允许回退全测，用“能成功响应”来发现无命名 free 的免费模型。
  // 大模型集没有 free 候选时直接跳过，避免 2 分钟 cron 下持续打出 400/403/429。
  if (sortedModels.length > FALLBACK_ALL_MODEL_LIMIT) {
    return []
  }

  return sortedModels
}
