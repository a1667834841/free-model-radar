#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const RESULTS_URL = process.env.RESULTS_URL ?? 'https://fm.ggball.top/api/results'

function fail(message) {
  console.error(`README sync failed: ${message}`)
  process.exitCode = 1
}

function formatThroughput(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function formatModels(provider, chinese, currentCell) {
  const models = Array.isArray(provider.models) ? provider.models : []
  const catalogMarker = chinese ? '目录：' : 'Catalog:'
  const catalogIndex = typeof currentCell === 'string' ? currentCell.indexOf(catalogMarker) : -1
  const catalogSuffix = catalogIndex >= 0
    ? `${chinese ? '' : ' '}${currentCell.slice(catalogIndex)}`
    : ''
  if (models.length === 0) {
    return `${chinese ? 'result：0 个模型。' : 'Result: 0 models.'}${catalogSuffix}`
  }

  const entries = models.map((model) => {
    const id = typeof model?.id === 'string' ? model.id : 'unknown'
    return `\`${id}\``
  })
  const prefix = chinese ? `result：${models.length} 个模型——` : `Result: ${models.length} model${models.length === 1 ? '' : 's'} — `
  return `${prefix}${entries.join(chinese ? '、' : ', ')}${catalogSuffix}`
}

function getMaxThroughput(provider) {
  const values = (Array.isArray(provider.models) ? provider.models : [])
    .map((model) => model?.tokensPerSec)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  return values.length > 0 ? Math.max(...values) : null
}

function formatMaxThroughput(provider) {
  const max = getMaxThroughput(provider)
  return max === null ? '—' : `${formatThroughput(max)} token/s`
}

function formatStatus(provider, chinese) {
  const hasData = Array.isArray(provider.models) && provider.models.length > 0
  if (chinese) return hasData ? '🟢 正常' : '🔴 无模型数据'
  return hasData ? '🟢 Normal' : '🔴 No model data'
}

function splitTableRow(line) {
  if (!line.startsWith('|') || !line.endsWith('|')) return null
  return line.slice(1, -1).split('|').map((cell) => cell.trim())
}

function updateReadme(content, result, chinese) {
  const lines = content.split('\n')
  const resultByName = new Map(result.providers.map((provider) => [provider.name, provider]))
  const updatedAt = typeof result.updatedAt === 'string' ? result.updatedAt : null
  if (!updatedAt) throw new Error('result API did not return updatedAt')

  const timestampPattern = chinese
    ? /^(.*最新快照（)`[^`]+`(）：.*)$/
    : /^(.*latest deployed \[`result` API\]\([^)]*\) snapshot \()`[^`]+`(\):.*)$/
  const timestampIndex = lines.findIndex((line) => timestampPattern.test(line))
  if (timestampIndex >= 0) {
    lines[timestampIndex] = lines[timestampIndex].replace(timestampPattern, `$1\`${updatedAt}\`$2`)
  }

  const headerIndex = lines.findIndex((line) => chinese
    ? line === '| 厂商 | 状态 | 可用模型 / 吞吐量 | 使用机制 | 跳转 |' || line === '| 厂商 | 状态 | 可用模型 | 厂商最大吞吐量 | 使用机制 | 跳转 |'
    : line === '| Provider | Status | Models / throughput | Usage mechanism | Link |' || line === '| Provider | Status | Available models | Max throughput | Usage mechanism | Link |')
  if (headerIndex >= 0) {
    lines[headerIndex] = chinese
      ? '| 厂商 | 状态 | 可用模型 | 厂商最大吞吐量 | 使用机制 | 跳转 |'
      : '| Provider | Status | Available models | Max throughput | Usage mechanism | Link |'
    lines[headerIndex + 1] = chinese
      ? '|------|------|------------|------------------|----------|------|'
      : '|----------|--------|----------------|-----------------|-----------------|------|'
  }

  if (headerIndex < 0) {
    throw new Error(`README ${chinese ? 'Chinese' : 'English'} provider table header not found`)
  }

  const providerRows = []
  const tableEnd = lines.findIndex((line, index) => index > headerIndex + 1 && !line.startsWith('|'))
  const endIndex = tableEnd >= 0 ? tableEnd : lines.length
  for (let index = headerIndex + 2; index < endIndex; index += 1) {
    const cells = splitTableRow(lines[index])
    if (!cells || (cells.length !== 5 && cells.length !== 6)) continue
    const providerName = cells[0].replace(/^\*\*|\*\*$/g, '')
    if (!providerName || providerName === '------') continue
    const provider = resultByName.get(providerName) ?? { name: providerName, models: [] }
    if (cells.length === 5) cells.splice(3, 0, '—')
    cells[1] = formatStatus(provider, chinese)
    cells[2] = formatModels(provider, chinese, cells[2])
    cells[3] = formatMaxThroughput(provider)
    providerRows.push({ index, cells, provider })
  }

  if (providerRows.length === 0) {
    throw new Error('README provider table contains no provider rows')
  }

  const rowIndexes = providerRows.map(({ index }) => index)
  const sortedRows = [...providerRows]
    .sort((left, right) => {
      const leftThroughput = getMaxThroughput(left.provider)
      const rightThroughput = getMaxThroughput(right.provider)
      if (leftThroughput === null && rightThroughput === null) return left.provider.name.localeCompare(right.provider.name)
      if (leftThroughput === null) return 1
      if (rightThroughput === null) return -1
      if (leftThroughput !== rightThroughput) return rightThroughput - leftThroughput
      return left.provider.name.localeCompare(right.provider.name)
    })
    .map(({ cells }) => `| ${cells.join(' | ')} |`)

  rowIndexes.forEach((index, position) => {
    lines[index] = sortedRows[position]
  })

  return lines.join('\n')
}

async function main() {
  const response = await fetch(RESULTS_URL, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`result API returned HTTP ${response.status}`)
  const result = await response.json()
  if (!result || !Array.isArray(result.providers)) throw new Error('result API returned an invalid payload')

  const files = [
    { path: 'README.md', chinese: false },
    { path: 'README.zh-CN.md', chinese: true },
  ]

  for (const file of files) {
    const current = await readFile(file.path, 'utf8')
    const next = updateReadme(current, result, file.chinese)
    if (next === current) {
      console.log(`${file.path}: no changes`)
      continue
    }
    if (process.argv.includes('--check')) {
      console.log(`${file.path}: changes available`)
      continue
    }
    await writeFile(file.path, next, 'utf8')
    console.log(`${file.path}: updated`)
  }
}

main().catch(fail)
