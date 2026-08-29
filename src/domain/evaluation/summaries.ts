import type { FlattenedModel } from './types'
import { resolveStreamingMetrics } from './types'

export type FastestTtftSummary = {
  id: string
  ttftMs: number
}

export function findFastestTtftModel(models: FlattenedModel[]): FastestTtftSummary | null {
  return models.reduce<FastestTtftSummary | null>((fastest, model) => {
    const ttftMs = resolveStreamingMetrics(model).ttftMs
    if (!fastest || ttftMs < fastest.ttftMs || (ttftMs === fastest.ttftMs && model.id.localeCompare(fastest.id) < 0)) {
      return { id: model.id, ttftMs }
    }
    return fastest
  }, null)
}
