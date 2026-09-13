import { createTrendResponse, type TrendResponse, type TrendSample } from '@/domain/trend'
import { getLatestResults } from './results-store'

const TREND_RANGE_DAYS = 7
const TREND_RETENTION_DAYS = 10
const TREND_DISPLAY_MODEL_LIMIT = 10

type TrendSampleRow = {
  provider_id: string
  provider_name: string
  model_id: string
  checked_at: string
  status: TrendSample['status']
  ttft_ms: number | null
  tokens_per_sec: number | null
  latency_ms: number | null
}

function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const ms = new Date(`${date}T00:00:00.000Z`).getTime()
  return isoDateFromMs(ms + days * 24 * 60 * 60 * 1000)
}

export function trendDateFromIso(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

export function recentTrendDates(rangeDays = TREND_RANGE_DAYS, now = new Date()): string[] {
  const today = trendDateFromIso(now.toISOString())
  return Array.from({ length: rangeDays }, (_, index) => addDays(today, index - rangeDays + 1))
}

function toTrendSample(row: TrendSampleRow): TrendSample {
  return {
    providerId: row.provider_id,
    providerName: row.provider_name,
    modelId: row.model_id,
    checkedAt: row.checked_at,
    status: row.status,
    ttftMs: row.ttft_ms,
    tokensPerSec: row.tokens_per_sec,
    latencyMs: row.latency_ms,
  }
}

async function appendTrendSamplesToD1(db: D1Database, samples: TrendSample[]): Promise<void> {
  if (samples.length === 0) return
  const createdAt = new Date().toISOString()
  for (const sample of samples) {
    await db.prepare(`
      INSERT INTO trend_samples (
        provider_id, provider_name, model_id, checked_at, status,
        ttft_ms, tokens_per_sec, latency_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, model_id, checked_at) DO UPDATE SET
        provider_name = excluded.provider_name,
        status = excluded.status,
        ttft_ms = excluded.ttft_ms,
        tokens_per_sec = excluded.tokens_per_sec,
        latency_ms = excluded.latency_ms
    `).bind(
      sample.providerId,
      sample.providerName,
      sample.modelId,
      sample.checkedAt,
      sample.status,
      sample.ttftMs,
      sample.tokensPerSec,
      sample.latencyMs,
      createdAt,
    ).run()
  }

  const cutoff = new Date(Date.now() - TREND_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await db.prepare('DELETE FROM trend_samples WHERE checked_at < ?').bind(cutoff).run()
}

async function getTrendSamplesFromD1(db: D1Database, rangeDays: number): Promise<TrendSample[]> {
  const dates = recentTrendDates(rangeDays)
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  if (!firstDate || !lastDate) return []
  const from = `${firstDate}T00:00:00.000Z`
  const to = `${addDays(lastDate, 1)}T00:00:00.000Z`
  const result = await db.prepare(`
    SELECT provider_id, provider_name, model_id, checked_at, status,
      ttft_ms, tokens_per_sec, latency_ms
    FROM trend_samples
    WHERE checked_at >= ? AND checked_at < ?
    ORDER BY checked_at ASC, id ASC
  `).bind(from, to).all<TrendSampleRow>()
  return result.results.map(toTrendSample)
}

export async function appendTrendSamples(db: D1Database, samples: TrendSample[]): Promise<void> {
  if (samples.length === 0) return
  await appendTrendSamplesToD1(db, samples)
}

export async function getTrendResponse(kv: KVNamespace, rangeDays = TREND_RANGE_DAYS, db: D1Database): Promise<TrendResponse> {
  const samples = await getTrendSamplesFromD1(db, rangeDays)

  // 只保留当前仍出现在 latest-results 里的活跃模型样本，剔除已消失模型，避免趋势 payload 膨胀。
  const latest = await getLatestResults(kv)
  const activeModelKeys = new Set<string>()
  for (const provider of latest?.providers ?? []) {
    for (const model of provider.models) {
      activeModelKeys.add(`${provider.id}:${model.id}`)
    }
  }

  const response = createTrendResponse(samples, rangeDays, new Date().toISOString(), activeModelKeys)
  const displayModels = response.modelStats.slice(0, TREND_DISPLAY_MODEL_LIMIT)
  const displayKeys = new Set(displayModels.map((model) => `${model.providerId}:${model.modelId}`))

  // D1 keeps every raw sample, while the public chart payload only contains
  // the models and points needed by the display table and its ten curves.
  return {
    ...response,
    samples: response.samples.filter((sample) => displayKeys.has(`${sample.providerId}:${sample.modelId}`)),
    modelStats: displayModels,
    providers: response.providers
      .map((provider) => ({
        ...provider,
        models: provider.models.filter((model) => displayKeys.has(`${model.providerId}:${model.modelId}`)),
      }))
      .filter((provider) => provider.models.length > 0),
  }
}
