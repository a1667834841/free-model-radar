import { createTrendResponse, type DailyTrendBucket, type TrendResponse, type TrendSample } from '@/domain/trend'
import { KV_KEYS } from './kv-keys'

const TREND_RANGE_DAYS = 7
const TREND_BUCKET_TTL_SECONDS = 10 * 24 * 60 * 60

function dateKey(date: string): string {
  return `${KV_KEYS.trendPrefix}${date}`
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

export async function getTrendBucket(kv: KVNamespace, date: string): Promise<DailyTrendBucket | null> {
  const value = await kv.get(dateKey(date))
  return value ? JSON.parse(value) as DailyTrendBucket : null
}

export async function appendTrendSamples(kv: KVNamespace, samples: TrendSample[]): Promise<void> {
  if (samples.length === 0) return

  const grouped = new Map<string, TrendSample[]>()
  for (const sample of samples) {
    const date = trendDateFromIso(sample.checkedAt)
    grouped.set(date, [...(grouped.get(date) ?? []), sample])
  }

  for (const [date, dateSamples] of grouped) {
    const existing = await getTrendBucket(kv, date)
    const bucket: DailyTrendBucket = {
      version: 1,
      date,
      samples: [...(existing?.samples ?? []), ...dateSamples],
    }
    await kv.put(dateKey(date), JSON.stringify(bucket), { expirationTtl: TREND_BUCKET_TTL_SECONDS })
    await kv.delete(dateKey(addDays(date, -8)))
  }
}

export async function getTrendResponse(kv: KVNamespace, rangeDays = TREND_RANGE_DAYS): Promise<TrendResponse> {
  const dates = recentTrendDates(rangeDays)
  const buckets = await Promise.all(dates.map((date) => getTrendBucket(kv, date)))
  const samples = buckets.flatMap((bucket) => bucket?.samples ?? [])
  return createTrendResponse(samples, rangeDays)
}
