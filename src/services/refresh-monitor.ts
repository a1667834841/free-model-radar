import type { RadarEnv } from '@/domain/env'
import type { ResultsSnapshot } from '@/domain/result'
import type { RefreshStatus } from '@/domain/refresh'
import { getLatestResults, getRefreshStatus } from '@/storage/results-store'
import { KV_KEYS } from '@/storage/kv-keys'

const DEFAULT_STALE_AFTER_MS = 60 * 60 * 1000
const DEFAULT_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000

export type RefreshHealth = {
  ok: boolean
  reason: 'healthy' | 'no_results' | 'stale_results' | 'refresh_failed' | 'refresh_stuck'
  checkedAt: string
  latestUpdatedAt: string | null
  refreshStatus: RefreshStatus
  ageMs: number | null
}

type MonitorState = {
  unhealthy: boolean
  lastNotifiedAt: string | null
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function evaluateRefreshHealth(
  results: ResultsSnapshot | null,
  status: RefreshStatus,
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): RefreshHealth {
  const checkedAt = now.toISOString()
  if (status.status === 'failed') {
    return { ok: false, reason: 'refresh_failed', checkedAt, latestUpdatedAt: results?.updatedAt ?? null, refreshStatus: status, ageMs: results ? now.getTime() - Date.parse(results.updatedAt) : null }
  }

  if (status.status === 'running' && status.startedAt && now.getTime() - Date.parse(status.startedAt) > staleAfterMs) {
    return { ok: false, reason: 'refresh_stuck', checkedAt, latestUpdatedAt: results?.updatedAt ?? null, refreshStatus: status, ageMs: results ? now.getTime() - Date.parse(results.updatedAt) : null }
  }

  if (!results) {
    return { ok: false, reason: 'no_results', checkedAt, latestUpdatedAt: null, refreshStatus: status, ageMs: null }
  }

  const ageMs = now.getTime() - Date.parse(results.updatedAt)
  if (!Number.isFinite(ageMs) || ageMs > staleAfterMs) {
    return { ok: false, reason: 'stale_results', checkedAt, latestUpdatedAt: results.updatedAt, refreshStatus: status, ageMs }
  }

  return { ok: true, reason: 'healthy', checkedAt, latestUpdatedAt: results.updatedAt, refreshStatus: status, ageMs }
}

function telegramConfig(env: RadarEnv): { token: string; chatId: string } | null {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (typeof token !== 'string' || token.length === 0 || typeof chatId !== 'string' || chatId.length === 0) return null
  return { token, chatId }
}

async function sendTelegramMessage(env: RadarEnv, message: string, fetchImpl: typeof fetch): Promise<void> {
  const config = telegramConfig(env)
  if (!config) throw new Error('Telegram notifier is not configured')

  const response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.chatId, text: message, disable_web_page_preview: true }),
  })
  if (!response.ok) throw new Error(`Telegram API returned HTTP ${response.status}`)
  const payload = await response.json() as { ok?: boolean }
  if (payload.ok !== true) throw new Error('Telegram API rejected the message')
}

function formatAlert(health: RefreshHealth): string {
  const age = health.ageMs == null ? '未知' : `${Math.max(0, Math.round(health.ageMs / 60_000))} 分钟`
  const error = health.refreshStatus.error ? `\n错误：${health.refreshStatus.error}` : ''
  return `🚨 Free Model Radar 刷新异常\n原因：${health.reason}\n最近数据：${health.latestUpdatedAt ?? '无'}\n数据年龄：${age}${error}`
}

export async function monitorRefreshHealth(
  env: RadarEnv,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshHealth & { notified: boolean; notificationError?: string }> {
  const [results, status] = await Promise.all([getLatestResults(env.RADAR_KV), getRefreshStatus(env.RADAR_KV)])
  const health = evaluateRefreshHealth(results, status, now, positiveNumber(env.REFRESH_STALE_AFTER_SECONDS, DEFAULT_STALE_AFTER_MS / 1000) * 1000)
  const configured = telegramConfig(env)
  const current = await env.RADAR_KV.get(KV_KEYS.refreshMonitorState)
  const previous = current ? JSON.parse(current) as MonitorState : { unhealthy: false, lastNotifiedAt: null }
  const cooldownMs = positiveNumber(env.TELEGRAM_ALERT_COOLDOWN_SECONDS, DEFAULT_ALERT_COOLDOWN_MS / 1000) * 1000
  const wasUnhealthy = previous.unhealthy === true
  const lastNotifiedAt = previous.lastNotifiedAt ? Date.parse(previous.lastNotifiedAt) : 0
  const shouldNotify = configured && (
    (!health.ok && (!wasUnhealthy || now.getTime() - lastNotifiedAt >= cooldownMs)) ||
    (health.ok && wasUnhealthy)
  )

  if (!shouldNotify) {
    return { ...health, notified: false, ...(configured ? {} : { notificationError: 'Telegram notifier is not configured' }) }
  }

  try {
    await sendTelegramMessage(env, health.ok ? `✅ Free Model Radar 已恢复\n数据更新时间：${health.latestUpdatedAt}` : formatAlert(health), fetchImpl)
    await env.RADAR_KV.put(KV_KEYS.refreshMonitorState, JSON.stringify({ unhealthy: !health.ok, lastNotifiedAt: now.toISOString() } satisfies MonitorState))
    return { ...health, notified: true }
  } catch (error) {
    return { ...health, notified: false, notificationError: error instanceof Error ? error.message : String(error) }
  }
}
