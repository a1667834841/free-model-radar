import { getLatestResults } from '@/storage/results-store'
import { getRadarEnv } from '@/lib/cloudflare'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function getMaxThroughput(provider: { models: Array<{ tokensPerSec?: number | null }> }): number | null {
  const values = provider.models
    .map((model) => model.tokensPerSec)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return values.length > 0 ? Math.max(...values) : null
}

export async function GET() {
  const env = await getRadarEnv()
  const results = await getLatestResults(env.RADAR_KV)
  const providers = (results?.providers ?? [])
    .map((provider) => ({
      name: provider.name,
      modelCount: provider.models.length,
      maxThroughput: getMaxThroughput(provider),
    }))
    .sort((left, right) => {
      if (left.maxThroughput === null && right.maxThroughput === null) {
        return left.name.localeCompare(right.name)
      }
      if (left.maxThroughput === null) return 1
      if (right.maxThroughput === null) return -1
      return right.maxThroughput - left.maxThroughput
    })

  const rowHeight = 36
  const headerHeight = 72
  const footerHeight = 34
  const width = 820
  const height = Math.max(headerHeight + footerHeight + rowHeight, headerHeight + footerHeight + providers.length * rowHeight)

  const rows = providers.length > 0
    ? providers.map((provider, index) => {
      const y = headerHeight + index * rowHeight + 24
      const normal = provider.modelCount > 0
      const status = normal ? '运行正常' : '无模型数据'
      const throughput = provider.maxThroughput === null
        ? '—'
        : `${provider.maxThroughput.toFixed(2)} token/s`

      return `
        <text x="24" y="${y}" fill="#e5e7eb" font-size="16">${escapeXml(provider.name)}</text>
        <text x="300" y="${y}" fill="${normal ? '#34d399' : '#f87171'}" font-size="14">${status}</text>
        <text x="470" y="${y}" fill="#cbd5e1" font-size="14">${provider.modelCount} 个模型</text>
        <text x="670" y="${y}" fill="#fbbf24" font-size="14" text-anchor="end">${throughput}</text>
      `
    }).join('')
    : '<text x="24" y="104" fill="#cbd5e1" font-size="14">暂无结果数据</text>'

  const updatedAt = results?.updatedAt
    ? new Date(results.updatedAt).toISOString()
    : '暂无更新时间'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <title>Free Model Radar provider status</title>
      <rect width="100%" height="100%" rx="12" fill="#0f1d26"/>
      <text x="24" y="30" fill="#ffffff" font-size="18" font-weight="700">Free Model Radar</text>
      <text x="24" y="53" fill="#94a3b8" font-size="12">实时厂商状态 · 最大吞吐量</text>
      <text x="24" y="${headerHeight - 10}" fill="#64748b" font-size="12">厂商</text>
      <text x="300" y="${headerHeight - 10}" fill="#64748b" font-size="12">状态</text>
      <text x="470" y="${headerHeight - 10}" fill="#64748b" font-size="12">可用模型</text>
      <text x="670" y="${headerHeight - 10}" fill="#64748b" font-size="12" text-anchor="end">最大吞吐量</text>
      ${rows}
      <text x="24" y="${height - 12}" fill="#64748b" font-size="11">更新于 ${escapeXml(updatedAt)}</text>
    </svg>
  `.trim()

  return new Response(svg, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
