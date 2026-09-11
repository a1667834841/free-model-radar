import { describe, expect, it } from 'vitest'
import { evaluateRefreshHealth } from '@/services/refresh-monitor'
import type { RefreshStatus } from '@/domain/refresh'

const idle: RefreshStatus = { status: 'idle', refreshId: null, startedAt: null, finishedAt: null, error: null, configVersion: null, progress: null }

describe('refresh monitor', () => {
  it('detects the stale result symptom reported in production', () => {
    const now = new Date('2026-09-08T18:10:00.000Z')
    const health = evaluateRefreshHealth({ updatedAt: '2026-09-07T18:06:07.548Z', refreshId: 'refresh-old', providers: [] }, idle, now)
    expect(health.ok).toBe(false)
    expect(health.reason).toBe('stale_results')
  })

  it('detects a refresh job that is stuck in running state', () => {
    const now = new Date('2026-09-08T18:10:00.000Z')
    const status: RefreshStatus = { ...idle, status: 'running', startedAt: '2026-09-08T16:00:00.000Z', refreshId: 'refresh-stuck' }
    const health = evaluateRefreshHealth(null, status, now)
    expect(health.reason).toBe('refresh_stuck')
  })

  it('does not alert for a fresh successful result', () => {
    const now = new Date('2026-09-08T18:10:00.000Z')
    const health = evaluateRefreshHealth({ updatedAt: '2026-09-08T17:50:00.000Z', refreshId: 'refresh-new', providers: [] }, { ...idle, status: 'success' }, now)
    expect(health).toMatchObject({ ok: true, reason: 'healthy' })
  })
})
