import type { ModelTrendStats, TrendMetricKey } from './trend'

export type LiveRankedModelRef = {
  providerId: string
  providerName?: string
  id: string
}

export type HoverSeriesPoint = { t: number; v: number }

export type HoverSeries = {
  key: string
  name: string
  color: string
  pts: HoverSeriesPoint[]
}

export type HoverRow = {
  key: string
  name: string
  color: string
  value: number
  time: number
}

function trendKey(model: Pick<ModelTrendStats, 'providerId' | 'modelId'>): string {
  return `${model.providerId}:${model.modelId}`
}

function liveKey(model: Pick<LiveRankedModelRef, 'providerId' | 'id'>): string {
  return `${model.providerId}:${model.id}`
}

/** 趋势图的统一显示名：厂商在前，模型在后；具体截断交给图例/tooltip 容器处理。 */
export function formatTrendModelName(model: Pick<ModelTrendStats, 'providerName' | 'modelId'>): string {
  const providerName = model.providerName.trim()
  const modelId = model.modelId.trim()
  return providerName ? `${providerName} · ${modelId}` : modelId
}

/**
 * 性能趋势展示模型必须跟实时概览/模型排行一致：以实时排行为主序，只选其中有趋势数据的模型。
 */
export function selectTrendModelsForLiveRanking(
  trendStats: ModelTrendStats[],
  liveRanking: LiveRankedModelRef[],
  limit = 10,
): ModelTrendStats[] {
  const byKey = new Map(trendStats.map((model) => [trendKey(model), model]))
  return liveRanking
    .map((model) => byKey.get(liveKey(model)))
    .filter((model): model is ModelTrendStats => Boolean(model))
    .slice(0, limit)
}

/**
 * 曲线图默认优先展示常用模型族：按实时排行顺序取 qwen、deepseek、glm 模型。
 */
export function selectPreferredTrendModelsForLiveRanking(
  trendStats: ModelTrendStats[],
  liveRanking: LiveRankedModelRef[],
  limit = 10,
): ModelTrendStats[] {
  const preferredStats = trendStats.filter((model) => /qwen|deepseek|glm/i.test(model.modelId))
  return selectTrendModelsForLiveRanking(preferredStats, liveRanking, limit)
}

/**
 * tooltip 展示当前图表所有可见曲线在同一采样 index 上的数据。
 * 不要求各模型 checkedAt 完全一致；否则真实采样有毫秒级偏差时只能看到一条线的数据。
 */
export function collectHoverRowsAtIndex(
  series: HoverSeries[],
  index: number,
  _metric: TrendMetricKey,
): HoverRow[] {
  return series
    .map((item): HoverRow | null => {
      const point = item.pts[index]
      if (!point || !Number.isFinite(point.v)) return null
      return { key: item.key, name: item.name, color: item.color, value: point.v, time: point.t }
    })
    .filter((row): row is HoverRow => row !== null)
    .sort((a, b) => b.value - a.value)
}

function nearestPoint(points: HoverSeriesPoint[], targetTime: number): HoverSeriesPoint | null {
  if (points.length === 0) return null
  return points.reduce((nearest, point) => {
    if (!nearest) return point
    return Math.abs(point.t - targetTime) < Math.abs(nearest.t - targetTime) ? point : nearest
  }, null as HoverSeriesPoint | null)
}

/**
 * 按真实时间戳收集 hover 数据，避免各模型采样缺失时用相同 index 导致时间错位。
 */
export function collectHoverRowsAtTime(
  series: HoverSeries[],
  targetTime: number,
  _metric: TrendMetricKey,
): HoverRow[] {
  return series
    .map((item): HoverRow | null => {
      const point = nearestPoint(item.pts, targetTime)
      if (!point || !Number.isFinite(point.v)) return null
      return { key: item.key, name: item.name, color: item.color, value: point.v, time: point.t }
    })
    .filter((row): row is HoverRow => row !== null)
    .sort((a, b) => b.value - a.value)
}
