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

type ModelTableRow = RankedModel

const modelTableFeatures = tableFeatures({})
const columnHelper = createColumnHelper<typeof modelTableFeatures, ModelTableRow>()

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

  const rankedModels = useMemo(() => method.rank(models), [models, method])
  const modelBest = useMemo(() => findModelBest(models), [models])
  const providerMeta = useMemo(() => {
    return Object.fromEntries(providers.map((provider) => [provider.id, provider]))
  }, [providers])

  // ── json-viewer：首次展开时才构建数据集（惰性渲染）
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonBuilt, setJsonBuilt] = useState(false)
  const [jsonCopyFlash, setJsonCopyFlash] = useState<'ok' | 'fail' | null>(null)
  const jsonCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 模型行展开状态：受控 details.open，首行默认展开（P2-7）
  const [rowOpenMap, setRowOpenMap] = useState<Record<string, boolean>>({})

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

  const firstRowId = modelRows[0] ? `${modelRows[0].providerId}:${modelRows[0].id}` : null
  useEffect(() => {
    if (!firstRowId) return
    setRowOpenMap((prev) => (firstRowId in prev ? prev : { ...prev, [firstRowId]: true }))
  }, [firstRowId])

  // 数据集结构对齐设计稿 buildDataset（下划线命名）；数据全部来自真实 props。
  const rankingDataset = useMemo(() => {
    if (!jsonBuilt) return null
    const latestCheckedAt = modelRows.reduce((acc, m) => (m.checkedAt > acc ? m.checkedAt : acc), '')
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
      models: modelRows.map((model, i) => ({
        rank: i + 1,
        name: model.id,
        ttft_ms: model.ttftMs ?? model.latencyMs,
        tps: model.tokensPerSec ?? null,
        e2e_ms: model.latencyMs,
        // TODO(i18n/domain): 现有数据模型（ModelResult）无模型参数量字段，scale 暂置 null
        scale: null,
      })),
    }
  }, [jsonBuilt, modelRows, method, t, locale])

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
        const isBestTtft = modelBest.bestTtft?.providerId === model.providerId && modelBest.bestTtft?.id === model.id
        const isBestTps = modelBest.bestTps?.providerId === model.providerId && modelBest.bestTps?.id === model.id
        const isBestE2e = modelBest.bestE2e?.providerId === model.providerId && modelBest.bestE2e?.id === model.id
        const showBadges = rankedModels.length > 1
        return (
          <span className="m-name">
            {model.id}
            {showBadges && isBestTtft && <span className="m-badge m-badge-ttft">{t('badge.bestTtft')}</span>}
            {showBadges && isBestTps && <span className="m-badge m-badge-tps">{t('badge.bestTps')}</span>}
            {showBadges && isBestE2e && <span className="m-badge m-badge-e2e">{t('badge.bestE2e')}</span>}
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
      id: 'status',
      header: t('table.col.status'),
      cell: ({ row }) => {
        const model = row.original
        return (
          <span className={`m-status ${model.freeStatus}`}>
            {model.freeStatus === 'free' ? t('status.free') : t('status.available')}
          </span>
        )
      },
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
    data: modelRows,
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
      freeStatus: model.freeStatus,
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
                  <span className="verdict">{model.freeStatus === 'free' ? 'FREE' : 'AVAILABLE'}</span>
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
            <span className="hide-sm">{t('table.col.latency')}</span>
            <span className="mh-right">{t('table.col.ttft')}</span>
            <span className="mh-right">{t('table.col.tps')}</span>
            <span className="mh-right hide-sm">{t('table.col.e2e')}</span>
            <span className="mh-right hide-sm">{t('table.col.score')}</span>
            <span className="mh-center">{t('table.col.status')}</span>
            <span />
          </div>

        {modelRows.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">⌁</span>
            <strong>{t('empty.models.title')}</strong>
            <span>{t('empty.models.desc')}</span>
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
