import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const remote = process.argv.includes('--remote')
const wranglerArgs = remote ? ['--remote'] : ['--local']
const batchSize = 500

function runWrangler(args: string[]): string {
  const result = spawnSync('npx', ['wrangler', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    throw new Error(`wrangler command failed: ${args.join(' ')}`)
  }
  return result.stdout.trim()
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const text = String(value).replaceAll("'", "''")
  return `'${text}'`
}

type Bucket = {
  samples?: Array<{
    providerId: string
    providerName: string
    modelId: string
    checkedAt: string
    status: string
    ttftMs: number | null
    tokensPerSec: number | null
    latencyMs: number | null
  }>
}

const keys = JSON.parse(runWrangler(['kv', 'key', 'list', '--binding', 'RADAR_KV', ...wranglerArgs, '--prefix', 'trend:'])) as Array<{ name: string }>
const tempDir = await mkdtemp(join(tmpdir(), 'free-model-radar-trend-migration-'))
let migrated = 0

try {
  for (const key of keys.sort((a, b) => a.name.localeCompare(b.name))) {
    const bucket = JSON.parse(runWrangler(['kv', 'key', 'get', key.name, '--binding', 'RADAR_KV', ...wranglerArgs])) as Bucket
    const samples = bucket.samples ?? []
    for (let offset = 0; offset < samples.length; offset += batchSize) {
      const batch = samples.slice(offset, offset + batchSize)
      const values = batch.map((sample) => `(${[
        sample.providerId,
        sample.providerName,
        sample.modelId,
        sample.checkedAt,
        sample.status,
        sample.ttftMs,
        sample.tokensPerSec,
        sample.latencyMs,
        new Date().toISOString(),
      ].map(sqlValue).join(', ')})`).join(',\n')
      const sql = `INSERT INTO trend_samples (provider_id, provider_name, model_id, checked_at, status, ttft_ms, tokens_per_sec, latency_ms, created_at) VALUES\n${values}\nON CONFLICT(provider_id, model_id, checked_at) DO UPDATE SET provider_name=excluded.provider_name, status=excluded.status, ttft_ms=excluded.ttft_ms, tokens_per_sec=excluded.tokens_per_sec, latency_ms=excluded.latency_ms;`
      const filePath = join(tempDir, 'batch.sql')
      await writeFile(filePath, sql, 'utf8')
      runWrangler(['d1', 'execute', 'free-model-radar', ...wranglerArgs, '--file', filePath])
      migrated += batch.length
      console.log(`migrated ${key.name}: ${Math.min(offset + batchSize, samples.length)}/${samples.length}`)
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

console.log(`Migrated ${migrated} trend samples from ${keys.length} KV buckets to D1.`)
