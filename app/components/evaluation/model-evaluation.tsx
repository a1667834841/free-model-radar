'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { ProviderResult } from '@/domain/result'
import {
  DEFAULT_EVALUATION_METHOD_ID,
  estimateTokensFromContent,
  getEvaluationMethod,
  type FlattenedModel,
  type RankedModel,
} from '@/domain/evaluation'
import { AGENT_OPTIONS } from '@/domain/agent-config'
import { useI18n } from '../../i18n'
import AgentConfigExport from '../export/agent-config-export'

type ModelEvaluationProps = {
  models: FlattenedModel[]
  providers: ProviderResult[]
  view: 'ranking' | 'provider'
  providerColors: Record<string, string>
}

function getScoreColor(ratio: number): string {
  if (ratio >= 0.66) return '#3FCF8E'
  if (ratio >= 0.33) return '#E8B44C'
  return '#E2625F'
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

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="detail-metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
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

  const rankedModels = useMemo(() => method.rank(models), [models, method])

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

  function renderModelRow(model: RankedModel) {
    const score = model.score
    const ratio = score != null && scoreMax > scoreMin ? (score - scoreMin) / (scoreMax - scoreMin) : 0
    const scorePct = ratio * 100
    const color = getScoreColor(ratio)
    const providerColor = providerColors[model.providerId] ?? '#5FB8CE'
    const displayRank = view === 'provider' ? model.groupRank : model.rank
    const checkedAt = new Date(model.checkedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
    // 吞吐用端到端耗时（latencyMs）作为时间 T，更贴近「一段时间内处理 N 个 token」的定义
    const generationMs = model.latencyMs
    const estimatedCompletionTokens = estimateTokensFromContent(model.content)
    const tpsTokenSource = model.tokenUsage.completionTokens != null
      ? t('detail.calc.providerTokens')
      : t('detail.calc.estimatedTokens')
    const tpsTokens = model.tokenUsage.completionTokens ?? estimatedCompletionTokens
    const sampleJsonText = JSON.stringify({
      model: model.id,
      provider: model.providerName,
      freeStatus: model.freeStatus,
      ttftMs: model.ttftMs ?? model.latencyMs,
      latencyMs: model.latencyMs,
      tokensPerSec: model.tokensPerSec,
      tokenUsage: model.tokenUsage,
      prompt: model.prompt ?? null,
      content: model.content ?? null,
      checkedAt: model.checkedAt,
    }, null, 2)

    return (
      <details
        className="model-row model-item"
        key={`${model.providerId}:${model.id}`}
        style={{ '--delay': `${model.rank * 45}ms` } as CSSProperties}
      >
        <summary title={t('detail.expandHint')} aria-label={`${model.id} ${t('detail.expandHint')}`}>
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
                style={{ width: `${Math.max(scorePct, 1)}%`, background: color }}
              />
            </span>
          </span>
          <span className="latency">
            <span className="latency-val">{model.ttftMs ?? model.latencyMs}</span>
            <small>ms</small>
          </span>
          <span className="metric-tps">
            <span className="latency-val">{formatTps(model.tokensPerSec)}</span>
            <small>t/s</small>
          </span>
          <span className="metric-e2e">
            <span className="latency-val">{model.latencyMs}</span>
            <small>ms</small>
          </span>
          <span className="metric-score">
            {model.score != null ? model.score.toFixed(1) : '—'}
          </span>
          <span className={`model-status ${model.freeStatus}`}>
            {model.freeStatus === 'free' ? t('status.free') : t('status.available')}
          </span>
          <span className="expand-caret" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 6 8 11 13 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>
        <div className="model-detail">
          <div className="detail-heading">
            <span>{t('detail.evidence')}</span>
            <small>{t('detail.evidenceNote')}</small>
          </div>
          <div className="detail-metrics">
            <DetailMetric label={t('detail.promptTokens')} value={formatNumber(model.tokenUsage.promptTokens)} />
            <DetailMetric label={t('detail.completionTokens')} value={formatNumber(model.tokenUsage.completionTokens)} />
            <DetailMetric label={t('detail.totalTokens')} value={formatNumber(model.tokenUsage.totalTokens)} />
            <DetailMetric label={t('detail.ttft')} value={formatMs(model.ttftMs ?? model.latencyMs)} />
            <DetailMetric label={t('detail.latency')} value={formatMs(model.latencyMs)} />
            <DetailMetric label={t('detail.checked')} value={checkedAt} />
          </div>
          <div className="detail-sample-grid">
            <div className="detail-sample-left">
              <div className="detail-json">
                <b className="detail-json-label">{t('detail.rawData')}</b>
                <pre className="detail-json-code"><code>{sampleJsonText}</code></pre>
              </div>
            </div>
            <div className="detail-calc-grid">
              <span>
                <b>{t('detail.calc.ttft')}</b>
                <code>{t('detail.calc.ttftFormula', { ttft: formatMs(model.ttftMs ?? model.latencyMs) })}</code>
              </span>
              <span>
                <b>{t('detail.calc.e2e')}</b>
                <code>{t('detail.calc.e2eFormula', { latency: formatMs(model.latencyMs) })}</code>
              </span>
              <span>
                <b>{t('detail.calc.tps')}</b>
                <code>
                  {model.tokensPerSec == null
                    ? t('detail.calc.tpsUnavailable')
                    : t('detail.calc.tpsFormula', {
                      tokens: formatNumber(tpsTokens),
                      duration: formatMs(generationMs),
                      tps: `${formatTps(model.tokensPerSec)} t/s`,
                      source: tpsTokenSource,
                    })}
                </code>
              </span>
            </div>
          </div>
        </div>
      </details>
    )
  }

  return (
    <section className="table-section evaluation-section">
      <div className="section-header">
        <div>
          <span className="section-kicker">
            {t(view === 'ranking' ? 'table.title' : 'table.titleProvider')}
            {method.noteKey ? (
              <i className="legend-help section-help" aria-label={t(method.noteKey)} data-tooltip={t(method.noteKey)}>?</i>
            ) : null}
          </span>
        </div>
        <div className="agent-export-control">
          <label className="agent-export-label" htmlFor="agent-export-select">{t('agent.label')}</label>
          <select
            id="agent-export-select"
            className="agent-export-select"
            value={exportTarget}
            onChange={(e) => setExportTarget(e.target.value)}
          >
            <option value="free-ids">{t('agent.modelIds')}</option>
            {AGENT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="model-table">
        <div className="model-row model-header eval-header">
          <span>{t('table.col.rank')}</span>
          <span>{t('table.col.model')}</span>
          <span>{t('table.col.provider')}</span>
          <span aria-hidden="true" />
          <span>{t('table.col.ttft')}</span>
          <span>{t('table.col.tps')}</span>
          <span>{t('table.col.e2e')}</span>
          <span>{t('table.col.score')}</span>
          <span>{t('table.col.status')}</span>
          <span aria-hidden="true" />
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

      {exportTarget && (
        <AgentConfigExport
          providers={providers}
          models={models}
          exportTarget={exportTarget}
          compact
        />
      )}
    </section>
  )
}
