'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { ProviderResult } from '@/domain/result'
import {
  DEFAULT_EVALUATION_METHOD_ID,
  getEvaluationMethod,
  listEvaluationMethods,
  type FlattenedModel,
  type RankedModel,
} from '@/domain/evaluation'
import { useI18n, type MessageKey } from '../../i18n'

type ModelEvaluationProps = {
  models: FlattenedModel[]
  providers: ProviderResult[]
  view: 'ranking' | 'provider'
  providerColors: Record<string, string>
  globalMinTtft: number
  globalMaxTtft: number
}

const TTFT_TIER = [
  { max: 500, color: '#3FCF8E' },
  { max: 1500, color: '#E8B44C' },
  { max: Infinity, color: '#E2625F' },
] as const

function getTtftColor(ms: number): string {
  for (const tier of TTFT_TIER) {
    if (ms <= tier.max) return tier.color
  }
  return '#E2625F'
}

function formatTps(value: number | null): string {
  if (value == null) return 'N/A'
  return value >= 100 ? value.toFixed(0) : value.toFixed(1)
}

export default function ModelEvaluation({
  models,
  providers,
  view,
  providerColors,
  globalMinTtft,
  globalMaxTtft,
}: ModelEvaluationProps) {
  const { t, locale } = useI18n()
  const [methodId, setMethodId] = useState(DEFAULT_EVALUATION_METHOD_ID)
  const method = getEvaluationMethod(methodId)
  const methods = listEvaluationMethods()

  const rankedModels = useMemo(() => method.rank(models), [models, method])

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

  const providerGroups = useMemo(() => {
    if (view !== 'provider') return []
    return [...providers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((provider) => ({
        ...provider,
        rows: modelRows.filter((model) => model.providerId === provider.id),
      }))
      .filter((provider) => provider.rows.length > 0)
  }, [modelRows, providers, view])

  const ttftRange = Math.max(globalMaxTtft - globalMinTtft, 1)
  const topModel = rankedModels[0] ?? null
  const showScore = method.id === 'streaming-performance'

  function renderModelRow(model: RankedModel) {
    const ttftMs = model.ttftMs ?? model.latencyMs
    const pct = ttftRange > 0 ? ((ttftMs - globalMinTtft) / ttftRange) * 100 : 0
    const color = getTtftColor(ttftMs)
    const providerColor = providerColors[model.providerId] ?? '#5FB8CE'
    const displayRank = view === 'provider' ? model.groupRank : model.rank

    return (
      <details
        className="model-row model-item"
        key={`${model.providerId}:${model.id}`}
        style={{ '--delay': `${model.rank * 45}ms` } as CSSProperties}
      >
        <summary>
          <span className="rank">{String(displayRank).padStart(2, '0')}</span>
          <span className="model-name">
            {model.id}
            {model.rank === 1 && rankedModels.length > 1 && (
              <span className="fastest-badge">{t('badge.fastest')}</span>
            )}
          </span>
          <span className="model-provider">
            <span className="provider-dot" style={{ background: providerColor }} />
            {model.providerName}
          </span>
          <span className="lat-band-cell">
            <span className="lat-band">
              <span
                className="lat-band-fill"
                style={{ width: `${Math.max(pct, 1)}%`, background: color }}
              />
            </span>
          </span>
          <span className="latency">
            <span className="latency-val">{ttftMs}</span>
            <small>ms</small>
          </span>
          <span className="metric-tps">
            <span className="latency-val">{formatTps(model.tokensPerSec)}</span>
            <small>t/s</small>
          </span>
          {showScore ? (
            <span className="metric-score">
              {model.score != null ? model.score.toFixed(1) : '—'}
            </span>
          ) : (
            <span className="metric-score muted">—</span>
          )}
          <span className={`model-status ${model.freeStatus}`}>
            {model.freeStatus === 'free' ? 'FREE' : 'AVAILABLE'}
          </span>
        </summary>
        <div className="model-detail">
          <span><b>{t('detail.prompt')}：</b>{model.prompt ?? 'N/A'}</span>
          <span className="detail-sep">·</span>
          <span><b>{t('detail.content')}：</b>{model.content ?? 'N/A'}</span>
          <span className="detail-sep">·</span>
          <span><b>{t('detail.latency')}：</b>{model.latencyMs} ms</span>
          <span className="detail-sep">·</span>
          <span>{t('detail.checked')}：{new Date(model.checkedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
        </div>
      </details>
    )
  }

  return (
    <section className="table-section evaluation-section">
      <div className="section-header">
        <div>
          <span className="section-kicker">{t(view === 'ranking' ? 'table.title' : 'table.titleProvider')}</span>
          {method.noteKey ? (
            <span className="section-hint eval-note">{t(method.noteKey)}</span>
          ) : null}
        </div>
        <div className="eval-controls">
          <div className="eval-method-switch" role="group" aria-label={t('eval.method.label')}>
            {methods.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`eval-method-btn ${methodId === item.id ? 'active' : ''}`}
                onClick={() => setMethodId(item.id)}
                aria-pressed={methodId === item.id}
                title={t(item.descriptionKey as MessageKey)}
              >
                {t(item.labelKey as MessageKey)}
              </button>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="legend-dot free-dot" />
              FREE
              <i className="legend-help" aria-label={t('legend.freeHelp')} data-tooltip={t('legend.freeHelp')}>?</i>
            </span>
            <span>
              <i className="legend-dot avail-dot" />
              AVAILABLE
              <i className="legend-help" aria-label={t('legend.availableHelp')} data-tooltip={t('legend.availableHelp')}>?</i>
            </span>
          </div>
        </div>
      </div>

      {topModel && method.id === 'streaming-performance' ? (
        <p className="eval-formula-hint">{t('eval.formula.hint')}</p>
      ) : null}

      <div className="model-table">
        <div className="model-row model-header eval-header">
          <span>{t('table.col.rank')}</span>
          <span>{t('table.col.model')}</span>
          <span>{t('table.col.provider')}</span>
          <span aria-hidden="true" />
          <span>{t('table.col.ttft')}</span>
          <span>{t('table.col.tps')}</span>
          <span>{showScore ? t('table.col.score') : ''}</span>
          <span>{t('table.col.status')}</span>
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
          : modelRows.map(renderModelRow)}
      </div>
    </section>
  )
}
