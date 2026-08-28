import type { ProviderConfig } from './provider'

export type DiscoveredModel = {
  id: string
}

export function isFreeModel(modelId: string, freeKeywords: string[]): boolean {
  const normalizedModelId = modelId.toLowerCase()
  return freeKeywords.some((keyword) => normalizedModelId.includes(keyword.toLowerCase()))
}

export function selectModelsForProbe(provider: ProviderConfig, models: DiscoveredModel[]): DiscoveredModel[] {
  const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id))
  const freeModels = sortedModels.filter((model) => isFreeModel(model.id, provider.freeKeywords))
  if (freeModels.length > 0) {
    return freeModels.slice(0, provider.probe.maxModels)
  }
  // 没有 free 命名模型时回退测试全部普通模型，不截断 maxModels。
  return sortedModels
}
