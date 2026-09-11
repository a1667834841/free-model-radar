'use client'

import type { CSSProperties } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
  type Row,
} from '@tanstack/react-table'
import type { ProviderResult } from '@/domain/result'
import {
  DEFAULT_EVALUATION_METHOD_ID,
  estimateTokensFromContent,
  findModelBest,
  getEvaluationMethod,
  type FlattenedModel,
  type ModelBestSummary,
  type RankedModel,
} from '@/domain/evaluation'
import { AGENT_OPTIONS } from '@/domain/agent-config'
import { highlightJson } from '@/lib/json-highlight'
import { getProviderIconUrl } from '@/lib/provider-icon'
import { getScoreTierVar } from '@/lib/score-tier'
import { useI18n } from '../../i18n'
import AgentConfigExport from '../export/agent-config-export'
import { getModelCapability } from '../../model-capabilities'

type ModelEvaluationProps = {
  models: FlattenedModel[]
  providers: ProviderResult[]
  view: 'ranking' | 'provider'
  providerColors: Record<string, string>
}

function formatTps(value: number | null): string {
  if (value == null) return 'N/A'
  return value >= 100 ? value.toFixed(0) : value.toFixed(1)
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return value.toLocaleString()
}

function formatMs(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return `${value.toLocaleString()} ms`
}

function matchesSearch(model: { id: string; providerName: string }, query: string): boolean {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = `${model.id} ${model.providerName}`.toLocaleLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

function getSortValue(model: RankedModel, key: SortKey): number | null {
  if (key === 'latency' || key === 'e2e') return model.latencyMs
  if (key === 'ttft') return model.ttftMs ?? model.latencyMs
  if (key === 'tps') return model.tokensPerSec
  return model.score
}

function compareModelsBySort(a: RankedModel, b: RankedModel, sort: SortState): number {
  if (!sort) return a.rank - b.rank
  const av = getSortValue(a, sort.key)
  const bv = getSortValue(b, sort.key)
  if (av == null && bv == null) return a.rank - b.rank
  if (av == null) return 1
  if (bv == null) return -1
  const diff = sort.direction === 'asc' ? av - bv : bv - av
  return diff || a.rank - b.rank
}

type ModelTableRow = RankedModel

type SortKey = 'latency' | 'ttft' | 'tps' | 'e2e' | 'score'
type SortDirection = 'asc' | 'desc'
type SortState = {
  key: SortKey
  direction: SortDirection
} | null

const CODING_SKILL_INSTALL_COMMAND = 'npx skills add https://github.com/a1667834841/free-model-radar --skill recommend-fast-llm'

const SORT_LABEL_KEYS: Record<SortKey, 'table.col.latency' | 'table.col.ttft' | 'table.col.tps' | 'table.col.e2e' | 'table.col.score'> = {
  latency: 'table.col.latency',
  ttft: 'table.col.ttft',
  tps: 'table.col.tps',
  e2e: 'table.col.e2e',
  score: 'table.col.score',
}

const modelTableFeatures = tableFeatures({})
const columnHelper = createColumnHelper<typeof modelTableFeatures, ModelTableRow>()

function CapabilityIcon({ type }: { type: 'context' | 'embedding' | 'image' | 'multimodal' }) {
  if (type === 'context') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="4" width="10" height="8" rx="2" />
        <path d="M5.2 6.5h5.6" />
        <path d="M5.2 9.5h3.8" />
      </svg>
    )
  }
  if (type === 'embedding') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="4" cy="4.5" r="1.7" />
        <circle cx="12" cy="4.5" r="1.7" />
        <circle cx="8" cy="11.5" r="1.7" />
        <path d="M5.5 5.6 7 10" />
        <path d="M10.5 5.6 9 10" />
        <path d="M5.7 4.5h4.6" />
      </svg>
    )
  }
  if (type === 'image') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.6" y="3.2" width="10.8" height="9.6" rx="2" />
        <circle cx="10.7" cy="5.8" r="1" />
        <path d="m3.5 11 3-3 2.1 2.1 1.1-1.1 2.8 2.8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.4" y="3.3" width="11.2" height="9.4" rx="2" />
      <circle cx="10.7" cy="5.8" r="1" />
      <path d="m3.6 11 2.8-2.8 2 2 1.1-1.1 2.9 2.9" />
      <path d="M4.8 5.6h2.8" />
    </svg>
  )
}

function ModelCapabilityTags({ model }: { model: RankedModel }) {
  const capability = getModelCapability(model)
  return (
    <span className="m-capabilities" aria-label="模型能力">
      <span className="m-cap-tag m-cap-context" title={`上下文长度：${capability.context} tokens`}>
        <CapabilityIcon type="context" />
        {capability.context}
      </span>
      {capability.isInputMultimodal && (
        <span className="m-cap-tag m-cap-multimodal" title="输入多模态">
          <CapabilityIcon type="multimodal" />
        </span>
      )}
      {capability.isEmbedding && (
        <span className="m-cap-tag m-cap-embedding" title="向量模型">
          <CapabilityIcon type="embedding" />
          向量
        </span>
      )}
      {capability.canGenerateImage && (
        <span className="m-cap-tag m-cap-image" title="生图模型">
          <CapabilityIcon type="image" />
          生图
        </span>
      )}
    </span>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export default function ModelEvaluation({
  models,
  providers,
  view,
  providerColors,
}: ModelEvaluationProps) {
  const { t, locale } = useI18n()
  const method = getEvaluationMethod(DEFAULT_EVALUATION_METHOD_ID)
  const [exportTarget, setExportTarget] = useState('free-ids')
  const [copySignal, setCopySignal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchActiveIndex, setSearchActiveIndex] = useState(0)
  const [codingKitOpen, setCodingKitOpen] = useState(false)
  const [codingKitCopied, setCodingKitCopied] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const rankedModels = useMemo(() => method.rank(models), [models, method])
  const modelBest = useMemo(() => findModelBest(models), [models])
  const providerMeta = useMemo(() => {
    return Object.fromEntries(providers.map((provider) => [provider.id, provider]))
  }, [providers])
  const codingModel = useMemo(() => {
    const healthyProvider = (model: RankedModel) => providerMeta[model.providerId]?.status === 'healthy'
    const codingName = /code|coder|coding|deepseek|qwen|claude|gpt|gemini|glm|kimi|mimo|minimax|nemotron|llama/i
    const codingCandidates = rankedModels.filter((model) => {
      const capability = getModelCapability(model)
      return healthyProvider(model) && !capability.isEmbedding && !capability.canGenerateImage && codingName.test(model.id)
    })
    return codingCandidates[0] ?? rankedModels.find((model) => healthyProvider(model) && !getModelCapability(model).isEmbedding) ?? rankedModels[0] ?? null
  }, [providerMeta, rankedModels])

  // ── json-viewer：首次展开时才构建数据集（惰性渲染）
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonBuilt, setJsonBuilt] = useState(false)
  const [jsonCopyFlash, setJsonCopyFlash] = useState<'ok' | 'fail' | null>(null)
  const jsonCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 模型行展开状态：受控 details.open，首行默认展开（P2-7）
  const [rowOpenMap, setRowOpenMap] = useState<Record<string, boolean>>({})
  const [sortState, setSortState] = useState<SortState>(null)

  const { scoreMin, scoreMax } = useMemo(() => {
    const scores = rankedModels.map((m) => m.score).filter((s): s is number => s != null)
    if (scores.length === 0) return { scoreMin: 0, scoreMax: 1 }
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    return { scoreMin: min, scoreMax: max === min ? min + 1 : max }
  }, [rankedModels])

  const modelRows: RankedModel[] = useMemo(() => {
    if (view === 'ranking') return rankedModels
    const grouped: RankedModel[] = []
    const sortedProviders = [...providers].sort((a, b) => a.name.localeCompare(b.name))
    let globalRank = 0
    for (const provider of sortedProviders) {
      const providerModels = rankedModels
        .filter((model) => model.providerId === provider.id)
        .sort((a, b) => a.rank - b.rank)
      let groupRank = 0
      for (const model of providerModels) {
        globalRank += 1
        groupRank += 1
        grouped.push({ ...model, rank: globalRank, groupRank })
      }
    }
    return grouped
  }, [rankedModels, providers, view])

  const filteredModelRows = useMemo(() => {
    return modelRows.filter((model) => matchesSearch(model, searchQuery))
  }, [modelRows, searchQuery])

  const visibleModelRows = useMemo(() => {
    return [...filteredModelRows].sort((a, b) => compareModelsBySort(a, b, sortState))
  }, [filteredModelRows, sortState])

  const searchSuggestions = useMemo(
    () => rankedModels.filter((model) => matchesSearch(model, searchQuery)).slice(0, 8),
    [rankedModels, searchQuery],
  )

  useEffect(() => {
    setSearchActiveIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (!searchOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [searchOpen])

  function toggleSort(key: SortKey) {
    setSortState((current) => {
      if (current?.key !== key) return { key, direction: key === 'tps' || key === 'score' ? 'desc' : 'asc' }
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function renderSortHeader(key: SortKey, className = 'mh-right') {
    const active = sortState?.key === key
    const direction = active ? sortState.direction : null
    return (
      <button
        type="button"
        className={`model-sort-head ${className}${active ? ' active' : ''}`}
        onClick={() => toggleSort(key)}
        aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
        title={t('table.sort.hint', { column: t(SORT_LABEL_KEYS[key]) })}
      >
        <span>{t(SORT_LABEL_KEYS[key])}</span>
        <span className="sort-indicator" aria-hidden="true">{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span>
      </button>
    )
  }

  const firstRowId = visibleModelRows[0] ? `${visibleModelRows[0].providerId}:${visibleModelRows[0].id}` : null
  useEffect(() => {
    if (!firstRowId) return
    setRowOpenMap((prev) => (firstRowId in prev ? prev : { ...prev, [firstRowId]: true }))
  }, [firstRowId])

  // 数据集结构对齐设计稿 buildDataset（下划线命名）；数据全部来自真实 props。
  const rankingDataset = useMemo(() => {
    if (!jsonBuilt) return null
    const latestCheckedAt = visibleModelRows.reduce((acc, m) => (m.checkedAt > acc ? m.checkedAt : acc), '')
    return {
      meta: {
        title: t('table.title'),
        note: method.noteKey ? t(method.noteKey) : '',
        // 真实评测数据，非示例
        sample: false,
        // 采样时间直接展示本地化时间戳，无需额外标签文案
        sampledAt: latestCheckedAt
          ? new Date(latestCheckedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
          : null,
      },
      models: visibleModelRows.map((model, i) => ({
        rank: i + 1,
        name: model.id,
        ttft_ms: model.ttftMs ?? model.latencyMs,
        tps: model.tokensPerSec ?? null,
        e2e_ms: model.latencyMs,
        // TODO(i18n/domain): 现有数据模型（ModelResult）无模型参数量字段，scale 暂置 null
        scale: null,
      })),
    }
  }, [jsonBuilt, visibleModelRows, method, t, locale])

  const handleToggleJson = useCallback(() => {
    setJsonBuilt(true)
    setJsonOpen((open) => !open)
  }, [])

  const handleCopyDataset = useCallback(async () => {
    if (!rankingDataset) return
    const text = JSON.stringify(rankingDataset, null, 2)
    let ok = true
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      ok = false
    }
    setJsonCopyFlash(ok ? 'ok' : 'fail')
    if (jsonCopyTimerRef.current) clearTimeout(jsonCopyTimerRef.current)
    jsonCopyTimerRef.current = setTimeout(() => setJsonCopyFlash(null), 1400)
  }, [rankingDataset])

  const handleDownloadDataset = useCallback(() => {
    if (!rankingDataset) return
    const blob = new Blob([JSON.stringify(rankingDataset, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'model-eval-ranking.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [rankingDataset])

  const handleCopyCodingKit = useCallback(async () => {
    const recommendation = codingModel
      ? `# 当前 Coding 推荐：${codingModel.providerName} / ${codingModel.id}`
      : '# 当前暂无可推荐 Coding 模型'
    try {
      await navigator.clipboard.writeText(`${CODING_SKILL_INSTALL_COMMAND}\n${recommendation}`)
      setCodingKitCopied(true)
      window.setTimeout(() => setCodingKitCopied(false), 1600)
    } catch {
      setCodingKitCopied(false)
    }
  }, [codingModel])

  useEffect(() => {
    return () => {
      if (jsonCopyTimerRef.current) clearTimeout(jsonCopyTimerRef.current)
    }
  }, [])

  const columns = useMemo(() => columnHelper.columns([
    columnHelper.display({
      id: 'rank',
      header: t('table.col.rank'),
      cell: ({ row }) => {
        const model = row.original
        const displayRank = view === 'provider' ? model.groupRank : model.rank
        return <span className="m-rank">{String(displayRank).padStart(2, '0')}</span>
      },
    }),
    columnHelper.display({
      id: 'model',
      header: t('table.col.model'),
      cell: ({ row }) => {
        const model = row.original
        const isBestTtft = rankedModels.length > 1 && modelBest.bestTtft?.providerId === model.providerId && modelBest.bestTtft?.id === model.id
        const isBestTps = rankedModels.length > 1 && modelBest.bestTps?.providerId === model.providerId && modelBest.bestTps?.id === model.id
        const isBestE2e = rankedModels.length > 1 && modelBest.bestE2e?.providerId === model.providerId && modelBest.bestE2e?.id === model.id
        const highlightClass = [
          isBestTtft ? 'best-ttft' : '',
          isBestTps ? 'best-tps' : '',
          isBestE2e ? 'best-e2e' : '',
        ].filter(Boolean).join(' ')
        return (
          <span className="m-name-wrap">
            <span className={`m-name${highlightClass ? ` ${highlightClass}` : ''}`}>
              {model.id}
            </span>
            <ModelCapabilityTags model={model} />
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'provider',
      header: t('table.col.provider'),
      cell: ({ row }) => {
        const model = row.original
        const providerColor = providerColors[model.providerId] ?? '#5FB8CE'
        const provider = providerMeta[model.providerId]
        const iconUrl = provider ? getProviderIconUrl(provider) : null
        const linkInner = (
          <>
            <span className="mini-fav" style={{ '--prov': providerColor } as CSSProperties}>
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                />
              ) : null}
            </span>
            {model.providerName || model.providerId}
          </>
        )
        return (
          <span className="m-prov hide-sm">
            <span className="m-prov-link">{linkInner}</span>
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'score-bar',
      header: '',
      cell: ({ row }) => {
        const model = row.original
        const score = model.score
        const ratio = score != null && scoreMax > scoreMin ? (score - scoreMin) / (scoreMax - scoreMin) : 0
        const scorePct = ratio * 100
        // 长度和颜色都由综合分驱动，避免 TTFT 颜色与综合排行产生误导。
        return (
          <span className="m-band hide-sm">
              <span
                className="m-band-fill"
                style={{ '--ratio': Math.max(scorePct, 1) / 100, background: getScoreTierVar(score) } as CSSProperties}
              />
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'ttft',
      header: t('table.col.ttft'),
      cell: ({ row }) => {
        const model = row.original
        return (
          <span className="m-num">
            {(model.ttftMs ?? model.latencyMs).toLocaleString()}<small>ms</small>
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'tps',
      header: t('table.col.tps'),
      cell: ({ row }) => (
        <span className="m-num">
          {formatTps(row.original.tokensPerSec)}<small>t/s</small>
        </span>
      ),
    }),
    columnHelper.display({
      id: 'e2e',
      header: t('table.col.e2e'),
      cell: ({ row }) => (
        <span className="m-num hide-sm">
          {row.original.latencyMs.toLocaleString()}<small>ms</small>
        </span>
      ),
    }),
    columnHelper.display({
      id: 'score',
      header: t('table.col.score'),
      cell: ({ row }) => (
        <span className="m-score hide-sm">
          {row.original.score != null ? row.original.score.toFixed(1) : '—'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'expand',
      header: '',
      cell: () => (
        <span className="m-caret" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 6 8 11 13 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ),
    }),
  ]), [modelBest, providerColors, providerMeta, rankedModels.length, scoreMax, scoreMin, t, view])

  const table = useTable({
    features: modelTableFeatures,
    data: visibleModelRows,
    columns,
    getRowId: (row) => `${row.providerId}:${row.id}`,
  })

  const tableRows = table.getRowModel().rows

  const providerGroups = useMemo(() => {
    if (view !== 'provider') return []
    return [...providers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((provider) => ({
        ...provider,
        rows: tableRows.filter((row) => row.original.providerId === provider.id),
      }))
      .filter((provider) => provider.rows.length > 0)
  }, [providers, tableRows, view])

  function renderModelRow(row: Row<typeof modelTableFeatures, ModelTableRow>, index: number) {
    const model = row.original
    const checkedAt = new Date(model.checkedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
    const isEstimatedTps = model.tpsQuality === 'estimated'
    // 吞吐用端到端耗时（latencyMs）作为时间 T，更贴近「一段时间内处理 N 个 token」的定义
    const generationMs = model.latencyMs
    const estimatedCompletionTokens = estimateTokensFromContent(model.content)
    const tpsTokenSource = model.tokenUsage.completionTokens != null
      ? t('detail.calc.providerTokens')
      : t('detail.calc.estimatedTokens')
    const tpsTokens = model.tokenUsage.completionTokens ?? estimatedCompletionTokens
    const sampleJson = {
      model: model.id,
      provider: model.providerName,
      ttftMs: model.ttftMs ?? model.latencyMs,
      latencyMs: model.latencyMs,
      tokensPerSec: model.tokensPerSec,
      tpsQuality: model.tpsQuality,
      tokenUsage: model.tokenUsage,
      prompt: model.prompt ?? null,
      content: model.content ?? null,
      checkedAt: model.checkedAt,
    }

    return (
      <details
        className="model-item"
        key={row.id}
        open={rowOpenMap[row.id] ?? false}
        onToggle={(event) => {
          const open = event.currentTarget.open
          setRowOpenMap((prev) => (prev[row.id] === open ? prev : { ...prev, [row.id]: open }))
        }}
        style={{ '--delay': `${Math.min(index * 45, 360)}ms` } as CSSProperties}
      >
        <summary className="model-row" title={t('detail.expandHint')} aria-label={`${model.id} ${t('detail.expandHint')}`}>
          {row.getAllCells().map((cell) => (
            <Fragment key={cell.id}>
              <table.FlexRender cell={cell} />
            </Fragment>
          ))}
        </summary>
        <div className="m-detail">
          <div className="m-detail-box">
            <div className="m-detail-head">
              <strong>{t('detail.evidence')}</strong>
              <small>{t('detail.evidenceNote')}</small>
            </div>
            <div className="m-detail-cols">
              <div className="m-detail-col m-detail-json">
                <div className="m-detail-colhead">
                  <b>{t('detail.rawJson')}</b>
                </div>
                <div className="json-code"><pre dangerouslySetInnerHTML={{ __html: highlightJson(sampleJson) }} /></div>
              </div>
              <div className="m-detail-col">
                <div className="m-detail-colhead">
                  <b>{t('detail.formulas')}</b>
                  <span className="verdict">{t(`cost.${model.cost?.type ?? 'unknown'}`)}</span>
                </div>
                <ul className="m-formula-ol">
                  <li><code>{t('detail.calc.ttftFormula', { ttft: formatMs(model.ttftMs ?? model.latencyMs) })}</code></li>
                  <li><code>{t('detail.calc.e2eFormula', { latency: formatMs(model.latencyMs) })}</code></li>
                  <li>
                    <code>
                      {model.tokensPerSec == null
                        ? t('detail.calc.tpsUnavailable')
                        : t('detail.calc.tpsFormula', {
                          tokens: formatNumber(tpsTokens),
                          duration: formatMs(generationMs),
                          tps: `${formatTps(model.tokensPerSec)} t/s`,
                          source: tpsTokenSource,
                        })}
                      {isEstimatedTps ? ` ${t('detail.calc.estimatedScoreExcluded')}` : ''}
                    </code>
                  </li>
                  <li><code>{t('detail.calc.scoreFormula', { score: model.score != null ? model.score.toFixed(1) : 'N/A' })}</code></li>
                  <li><code>{t('detail.checked')}: {checkedAt}</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </details>
    )
  }

  return (
    <section className="section table-section evaluation-section">
      <div className="section-head">
        <div className="rank-title">
          <button
            type="button"
            className="rank-toggle"
            aria-expanded={jsonOpen}
            aria-controls="rank-json"
            onClick={handleToggleJson}
          >
            {t(view === 'ranking' ? 'table.title' : 'table.titleProvider')}
            {method.noteKey ? (
              <i className="help-dot section-help" aria-label={t(method.noteKey)} data-tip={t(method.noteKey)}>?</i>
            ) : null}
            <span className="rank-caret" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6 8 10 12 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        </div>
        <div className="evaluation-tools">
          <div className="model-search-wrap" ref={searchContainerRef}>
            <label className="model-search" htmlFor="model-search-input">
              <svg className="model-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span className="sr-only">{t('search.label')}</span>
              <input
                id="model-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSearchOpen(Boolean(event.target.value.trim()))
                }}
                onFocus={() => setSearchOpen(Boolean(searchQuery.trim()))}
                onKeyDown={(event) => {
                  if (!searchOpen || searchSuggestions.length === 0) {
                    if (event.key === 'Escape') setSearchOpen(false)
                    return
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setSearchActiveIndex((index) => (index + 1) % searchSuggestions.length)
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setSearchActiveIndex((index) => (index - 1 + searchSuggestions.length) % searchSuggestions.length)
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    const suggestion = searchSuggestions[searchActiveIndex]
                    if (suggestion) {
                      setSearchQuery(suggestion.id)
                      setSearchOpen(false)
                    }
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setSearchOpen(false)
                  }
                }}
                placeholder={t('search.placeholder')}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searchOpen && searchSuggestions.length > 0}
                aria-controls="model-search-suggestions"
                aria-activedescendant={searchOpen && searchSuggestions[searchActiveIndex]
                  ? `model-search-option-${searchSuggestions[searchActiveIndex].providerId}-${searchActiveIndex}`
                  : undefined}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="model-search-clear"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchOpen(false)
                  }}
                  aria-label={t('search.clear')}
                >
                  ×
                </button>
              )}
            </label>
            <span className="model-search-count">
              {searchQuery.trim() ? t('search.matchCount', { count: visibleModelRows.length }) : t('search.totalCount', { count: modelRows.length })}
            </span>
            {searchOpen && searchSuggestions.length > 0 && (
              <div id="model-search-suggestions" className="model-search-dropdown" role="listbox" aria-label={t('search.suggestions')}>
                {searchSuggestions.map((model, index) => (
                  <button
                    key={`${model.providerId}:${model.id}`}
                    id={`model-search-option-${model.providerId}-${index}`}
                    type="button"
                    className={`model-search-option${index === searchActiveIndex ? ' active' : ''}`}
                    role="option"
                    aria-selected={index === searchActiveIndex}
                    onMouseEnter={() => setSearchActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setSearchQuery(model.id)
                      setSearchOpen(false)
                    }}
                  >
                    <span className="model-search-option-main">
                      <strong>{model.id}</strong>
                      <small>{model.providerName}</small>
                    </span>
                    <span className="model-search-option-meta">{formatMs(model.ttftMs)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="export-bar">
            <label className="export-control" htmlFor="agent-export-select">
              <span className="mono-eyebrow">{t('agent.label')}</span>
            </label>
            <select
              id="agent-export-select"
              className="export-select"
              value={exportTarget}
              onChange={(e) => {
                setExportTarget(e.target.value)
              }}
            >
              <option value="free-ids">{t('agent.modelIds')}</option>
              {AGENT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost export-btn"
              type="button"
              onClick={() => setCopySignal((signal) => signal + 1)}
            >
              {t('agent.copy')}
            </button>
          </div>
          <div className="coding-kit">
            <button
              type="button"
              className={`coding-kit-trigger${codingKitOpen ? ' open' : ''}${codingKitCopied ? ' copied' : ''}`}
              onClick={() => {
                setCodingKitOpen((open) => !open)
                void handleCopyCodingKit()
              }}
              aria-expanded={codingKitOpen}
              aria-controls="coding-kit-menu"
            >
              <span className="coding-kit-copy-icon" aria-hidden="true"><CopyIcon /></span>
              {codingKitCopied ? t('codingKit.copied') : t('codingKit.install')}
              <span className="coding-kit-caret" aria-hidden="true">⌃</span>
            </button>
            {codingKitOpen && (
              <div id="coding-kit-menu" className="coding-kit-menu">
                <div className="coding-kit-menu-label">{t('codingKit.title')}</div>
                <div className="coding-kit-model">
                  <span className="coding-kit-model-provider">{codingModel?.providerName ?? '—'}</span>
                  <strong>{codingModel?.id ?? t('codingKit.noModel')}</strong>
                </div>
                <code className="coding-kit-command">{CODING_SKILL_INSTALL_COMMAND}</code>
                <div className="coding-kit-help">{t('codingKit.help')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rank-note" aria-label={t('rank.note.aria')}>
        <span><i className="rank-note-dot ttft" />{t('rank.note.ttft')}</span>
        <span><i className="rank-note-dot tps" />{t('rank.note.tps')}</span>
        <span><i className="rank-note-dot e2e" />{t('rank.note.e2e')}</span>
      </div>

      <div
        id="rank-json"
        className={`json-viewer${jsonOpen ? ' open' : ''}`}
        role="region"
        aria-label={t('eval.json.ariaLabel')}
      >
        <div className="json-viewer-head">
          <span className="json-viewer-title">
            <span className="mono-eyebrow">{t('eval.json.title')}</span>
            <span className="json-sample">{t('eval.json.real')}</span>
          </span>
          <div className="json-viewer-actions">
            <button
              type="button"
              className={`json-btn copy${jsonCopyFlash === 'ok' ? ' copied' : ''}`}
              onClick={handleCopyDataset}
            >
              {jsonCopyFlash === 'ok' ? t('agent.copied') : jsonCopyFlash === 'fail' ? t('agent.copyFailed') : t('agent.copy')}
            </button>
            <button type="button" className="json-btn primary" onClick={handleDownloadDataset}>
              {t('eval.json.download')}
            </button>
            <button type="button" className="json-btn" onClick={() => { setJsonOpen(false) }}>
              {t('eval.json.collapse')}
            </button>
          </div>
        </div>
        <div className="json-code"><pre dangerouslySetInnerHTML={{ __html: rankingDataset ? highlightJson(rankingDataset) : '' }} /></div>
      </div>

      <div className="model-card" key={view}>
        <div className="model-scroll">
          <div className="model-head">
            <span>{t('table.col.rank')}</span>
            <span>{t('table.col.model')}</span>
            <span className="hide-sm">{t('table.col.provider')}</span>
            {renderSortHeader('latency', 'hide-sm')}
            {renderSortHeader('ttft')}
            {renderSortHeader('tps')}
            {renderSortHeader('e2e', 'mh-right hide-sm')}
            {renderSortHeader('score', 'mh-right hide-sm')}
            <span />
          </div>

        {modelRows.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">⌁</span>
            <strong>{t('empty.models.title')}</strong>
            <span>{t('empty.models.desc')}</span>
          </div>
        )}

        {modelRows.length > 0 && visibleModelRows.length === 0 && (
          <div className="empty-state model-search-empty">
            <span className="empty-icon">⌕</span>
            <strong>{t('search.noResultsTitle')}</strong>
            <span>{t('search.noResultsDesc')}</span>
          </div>
        )}

        {view === 'provider'
          ? providerGroups.map((provider) => (
            <div className="provider-group" key={provider.id}>
              <div className="provider-group-header">
                <span className="provider-group-name">
                  <span className="overview-dot" style={{ background: providerColors[provider.id] }} />
                  {provider.name}
                </span>
                <span className="provider-group-meta">
                  {t('provider.models', { count: provider.rows.length })}
                </span>
              </div>
              {provider.rows.map(renderModelRow)}
            </div>
          ))
          : tableRows.map(renderModelRow)}
        </div>
      </div>

      {exportTarget && (
        <AgentConfigExport
          providers={providers}
          models={models}
          exportTarget={exportTarget}
          copySignal={copySignal}
          compact
        />
      )}
    </section>
  )
}
