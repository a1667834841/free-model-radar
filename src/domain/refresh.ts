export type RefreshQueueMessage = {
  refreshId: string
  isNewRefresh?: boolean
}

export type RefreshStatusValue = 'idle' | 'running' | 'success' | 'failed'

export type RefreshStatus = {
  status: RefreshStatusValue
  refreshId: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
  configVersion: number | null
  progress: { completed: number; total: number } | null
}

export type RefreshLock = {
  refreshId: string
  acquiredAt: string
  expiresAt: string
}

import type { ModelResult } from './result'
import type { DiscoveredModel } from './model'

export type RefreshJobProvider = {
  id: string
  name: string
  baseUrl: string
  models: DiscoveredModel[]
  cursor: number
  successfulModels: ModelResult[]
}

export type RefreshJob = {
  refreshId: string
  configVersion: number
  startedAt: string
  providers: RefreshJobProvider[]
  completed: number
  total: number
}

export function createRefreshId(now = new Date()): string {
  return `refresh-${now.toISOString()}-${crypto.randomUUID()}`
}
