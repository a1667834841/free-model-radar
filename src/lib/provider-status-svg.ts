import type { ResultsSnapshot } from '@/domain/result'

type ProviderSummary = {
  name: string
  modelCount: number
  maxThroughput: number | null
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—'

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`
}

function getMaxThroughput(provider: ResultsSnapshot['providers'][number]): number | null {
  const values = provider.models
    .map((model) => model.tokensPerSec)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return values.length > 0 ? Math.max(...values) : null
}

function summarizeProviders(results: ResultsSnapshot | null): ProviderSummary[] {
  return (results?.providers ?? [])
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
}

export function renderProviderStatusSvg(results: ResultsSnapshot | null, chinese: boolean): string {
  const labels = chinese
    ? {
      title: 'Free Model Radar',
      subtitle: '实时厂商状态 · 最大吞吐量',
      provider: '厂商',
      status: '状态',
      models: '可用模型',
      throughput: '最大吞吐量',
      normal: '运行正常',
      noData: '无模型数据',
      modelSuffix: '个模型',
      empty: '暂无结果数据',
      updatedAt: '更新于',
    }
    : {
      title: 'Free Model Radar',
      subtitle: 'Live provider status · Max throughput',
      provider: 'Provider',
      status: 'Status',
      models: 'Available models',
      throughput: 'Max throughput',
      normal: 'Normal',
      noData: 'No model data',
      modelSuffix: 'model',
      empty: 'No result data',
      updatedAt: 'Updated at',
    }

  const providers = summarizeProviders(results)
  const rowHeight = 36
  const headerHeight = 72
  const footerHeight = 34
  const width = 820
  const height = Math.max(headerHeight + footerHeight + rowHeight, headerHeight + footerHeight + providers.length * rowHeight)

  const rows = providers.length > 0
    ? providers.map((provider, index) => {
      const y = headerHeight + index * rowHeight + 24
      const normal = provider.modelCount > 0
      const modelLabel = chinese
        ? `${provider.modelCount} ${labels.modelSuffix}`
        : `${provider.modelCount} ${labels.modelSuffix}${provider.modelCount === 1 ? '' : 's'}`
      const throughput = provider.maxThroughput === null
        ? '—'
        : `${provider.maxThroughput.toFixed(2)} token/s`

      return `
        <text x="24" y="${y}" fill="#e5e7eb" font-size="16">${escapeXml(provider.name)}</text>
        <text x="300" y="${y}" fill="${normal ? '#34d399' : '#f87171'}" font-size="14">${normal ? labels.normal : labels.noData}</text>
        <text x="470" y="${y}" fill="#cbd5e1" font-size="14">${modelLabel}</text>
        <text x="670" y="${y}" fill="#fbbf24" font-size="14" text-anchor="end">${throughput}</text>
      `
    }).join('')
    : `<text x="24" y="104" fill="#cbd5e1" font-size="14">${labels.empty}</text>`

  const updatedAt = formatTimestamp(results?.updatedAt ?? null)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <title>${escapeXml(labels.title)}</title>
      <rect width="100%" height="100%" rx="12" fill="#0f1d26"/>
      <text x="24" y="30" fill="#ffffff" font-size="18" font-weight="700">${escapeXml(labels.title)}</text>
      <text x="24" y="53" fill="#94a3b8" font-size="12">${escapeXml(labels.subtitle)}</text>
      <text x="24" y="${headerHeight - 10}" fill="#64748b" font-size="12">${escapeXml(labels.provider)}</text>
      <text x="300" y="${headerHeight - 10}" fill="#64748b" font-size="12">${escapeXml(labels.status)}</text>
      <text x="470" y="${headerHeight - 10}" fill="#64748b" font-size="12">${escapeXml(labels.models)}</text>
      <text x="670" y="${headerHeight - 10}" fill="#64748b" font-size="12" text-anchor="end">${escapeXml(labels.throughput)}</text>
      ${rows}
      <text x="24" y="${height - 12}" fill="#64748b" font-size="11">${escapeXml(labels.updatedAt)} ${updatedAt}</text>
    </svg>
  `.trim()

  return svg
}

export function createProviderStatusSvgResponse(svg: string): Response {
  return new Response(svg, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
