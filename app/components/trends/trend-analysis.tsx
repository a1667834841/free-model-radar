'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n'
import type { ModelTrendStats, TrendMetricKey, TrendResponse, TrendSample } from '@/domain/trend'

type TrendAnalysisProps = {
  trends: TrendResponse
  providerColors: Record<string, string>
}

type MetricOption = {
  key: TrendMetricKey
  labelKey: MessageKey
  shortLabelKey: MessageKey
  unit: string
  lowerIsBetter: boolean
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'ttftMs', labelKey: 'trend.metric.ttft', shortLabelKey: 'trend.metric.ttftShort', unit: 'ms', lowerIsBetter: true },
  { key: 'tokensPerSec', labelKey: 'trend.metric.tps', shortLabelKey: 'trend.metric.tpsShort', unit: 't/s', lowerIsBetter: false },
  { key: 'latencyMs', labelKey: 'trend.metric.e2e', shortLabelKey: 'trend.metric.e2eShort', unit: 'ms', lowerIsBetter: true },
]

function getMetricOption(metric: TrendMetricKey): MetricOption {
  return METRIC_OPTIONS.find((option) => option.key === metric) ?? METRIC_OPTIONS[0]
}

function modelKey(model: Pick<ModelTrendStats, 'providerId' | 'modelId'>): string {
  return `${model.providerId}:${model.modelId}`
}

function sampleKey(sample: Pick<TrendSample, 'providerId' | 'modelId'>): string {
  return `${sample.providerId}:${sample.modelId}`
}

function formatMetric(value: number | null, metric: TrendMetricKey): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (metric === 'tokensPerSec') return value >= 100 ? value.toFixed(0) : value.toFixed(1)
  return String(Math.round(value))
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function compareMetricValues(a: number | null, b: number | null, lowerIsBetter: boolean): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return lowerIsBetter ? a - b : b - a
}

function stabilityClass(successRate: number): string {
  if (successRate >= 0.95) return 'good'
  if (successRate >= 0.8) return 'ok'
  return 'bad'
}

export default function TrendAnalysis({ trends, providerColors }: TrendAnalysisProps) {
  const { t } = useI18n()
  const [metric, setMetric] = useState<TrendMetricKey>('ttftMs')
  const option = getMetricOption(metric)
  const sampledDayCount = trends.bucketDates.length
  const canShowTrendCharts = sampledDayCount >= 2

  const rankedModels = useMemo(() => {
    return [...trends.modelStats].sort((a, b) => {
      const metricCompare = compareMetricValues(a.median[metric], b.median[metric], option.lowerIsBetter)
      if (metricCompare !== 0) return metricCompare
      if (a.successRate !== b.successRate) return b.successRate - a.successRate
      return a.modelId.localeCompare(b.modelId)
    })
  }, [metric, option.lowerIsBetter, trends.modelStats])

  const topModel = rankedModels[0] ?? null
  const mostStableModel = useMemo(() => {
    return [...trends.modelStats].sort((a, b) => {
      if (a.successRate !== b.successRate) return b.successRate - a.successRate
      return compareMetricValues(a.p95.ttftMs, b.p95.ttftMs, true)
    })[0] ?? null
  }, [trends.modelStats])

  if (trends.samples.length === 0) {
    return (
      <section className="trend-section">
        <div className="empty-state trend-empty">
          <span className="empty-icon">⌁</span>
          <strong>{t('trend.empty.title')}</strong>
          <span>{t('trend.empty.desc')}</span>
        </div>
      </section>
    )
  }

  return (
    <section className="trend-section">
      <div className="trend-hero">
        <div>
          <span className="section-kicker">{t('trend.title')}</span>
          <p className="trend-lede">{t('trend.subtitle')}</p>
        </div>
        <div className="trend-range">
          <span>{t('trend.range')}</span>
          <strong>{trends.rangeDays}d</strong>
        </div>
      </div>

      <div className="trend-metrics">
        <TrendSummaryCard
          label={t('trend.summary.bestMedian')}
          value={topModel ? formatMetric(topModel.median[metric], metric) : '—'}
          unit={topModel ? option.unit : ''}
          detail={topModel ? topModel.modelId : '—'}
          tone="green"
        />
        <TrendSummaryCard
          label={t('trend.summary.stability')}
          value={mostStableModel ? formatPercent(mostStableModel.successRate) : '—'}
          detail={mostStableModel ? mostStableModel.modelId : '—'}
          tone="cyan"
        />
        <TrendSummaryCard
          label={t('trend.summary.models')}
          value={String(trends.modelStats.length)}
          detail={t('trend.summary.samples', { count: trends.samples.length })}
          tone="amber"
        />
      </div>

      <div className="trend-toolbar">
        <div className="metric-tabs" role="tablist" aria-label={t('trend.metricTabs')}>
          {METRIC_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`metric-tab ${metric === item.key ? 'active' : ''}`}
              onClick={() => setMetric(item.key)}
              aria-pressed={metric === item.key}
            >
              {t(item.shortLabelKey)}
            </button>
          ))}
        </div>
        <span className="trend-hint">
          {option.lowerIsBetter ? t('trend.lowerBetter') : t('trend.higherBetter')}
        </span>
      </div>

      {canShowTrendCharts ? (
        <TrendChart
          title={t('trend.chart.allModels')}
          subtitle={t('trend.chart.allModelsSub')}
          samples={trends.samples}
          models={rankedModels}
          metric={metric}
          providerColors={providerColors}
          globalScale
        />
      ) : (
        <div className="trend-pending">
          <strong>{t('trend.pending.title')}</strong>
          <span>{t('trend.pending.desc', { count: sampledDayCount })}</span>
        </div>
      )}

      <TrendStatsTable models={rankedModels} metric={metric} option={option} />

      <section className="provider-trend-section">
        <div className="section-header">
          <div>
            <span className="section-kicker">{t('trend.provider.title')}</span>
            <span className="section-hint">{t('trend.provider.sub')}</span>
          </div>
        </div>
        <div className="provider-trend-list">
          {trends.providers.map((provider) => (
            <details className="provider-trend-card" key={provider.providerId}>
              <summary>
                <span className="provider-trend-name">
                  <span className="overview-dot" style={{ background: providerColors[provider.providerId] ?? '#5FB8CE' }} />
                  {provider.providerName}
                </span>
                <span className="provider-trend-stat">
                  {t('trend.provider.models', { count: provider.stats.modelCount })}
                </span>
                <span className="provider-trend-stat">
                  {t('trend.table.median')} {formatMetric(provider.stats.median[metric], metric)} {provider.stats.median[metric] == null ? '' : option.unit}
                </span>
                <span className={`stability-pill ${stabilityClass(provider.stats.successRate)}`}>
                  {formatPercent(provider.stats.successRate)}
                </span>
              </summary>
              {canShowTrendCharts ? (
                <TrendChart
                  title={provider.providerName}
                  subtitle={t('trend.chart.providerSub')}
                  samples={trends.samples.filter((sample) => sample.providerId === provider.providerId)}
                  models={provider.models}
                  metric={metric}
                  providerColors={providerColors}
                />
              ) : (
                <div className="trend-pending provider-pending">
                  <strong>{t('trend.pending.title')}</strong>
                  <span>{t('trend.pending.desc', { count: sampledDayCount })}</span>
                </div>
              )}
            </details>
          ))}
        </div>
      </section>
    </section>
  )
}

function TrendSummaryCard({ label, value, unit, detail, tone }: {
  label: string
  value: string
  unit?: string
  detail: string
  tone: 'green' | 'cyan' | 'amber'
}) {
  return (
    <article className={`trend-summary ${tone}`}>
      <span>{label}</span>
      <strong>{value}{unit ? <small>{unit}</small> : null}</strong>
      <em>{detail}</em>
    </article>
  )
}

function TrendStatsTable({ models, metric, option }: {
  models: ModelTrendStats[]
  metric: TrendMetricKey
  option: MetricOption
}) {
  const { t } = useI18n()
  return (
    <div className="trend-table">
      <div className="trend-row trend-row-header">
        <span>{t('table.col.model')}</span>
        <span>{t('table.col.provider')}</span>
        <span>{t('trend.table.median')}</span>
        <span>{t('trend.table.avg')}</span>
        <span>P95</span>
        <span>{t('trend.table.success')}</span>
        <span>{t('trend.table.current')}</span>
      </div>
      {models.slice(0, 40).map((model) => (
        <div className="trend-row" key={modelKey(model)}>
          <span className="trend-model-name">{model.modelId}</span>
          <span>{model.providerName}</span>
          <MetricCell value={model.median[metric]} metric={metric} unit={option.unit} />
          <MetricCell value={model.avg[metric]} metric={metric} unit={option.unit} />
          <MetricCell value={model.p95[metric]} metric={metric} unit={option.unit} muted={model.p95[metric] == null} />
          <span className={`stability-pill ${stabilityClass(model.successRate)}`}>{formatPercent(model.successRate)}</span>
          <MetricCell value={model.current[metric]} metric={metric} unit={option.unit} />
        </div>
      ))}
    </div>
  )
}

function MetricCell({ value, metric, unit, muted = false }: {
  value: number | null
  metric: TrendMetricKey
  unit: string
  muted?: boolean
}) {
  return (
    <span className={`trend-metric-cell ${muted ? 'muted' : ''}`}>
      {formatMetric(value, metric)}
      {value == null ? null : <small>{unit}</small>}
    </span>
  )
}

function TrendChart({ title, subtitle, samples, models, metric, providerColors, globalScale = false }: {
  title: string
  subtitle: string
  samples: TrendSample[]
  models: ModelTrendStats[]
  metric: TrendMetricKey
  providerColors: Record<string, string>
  globalScale?: boolean
}) {
  const { t } = useI18n()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const width = 900
  const height = 280
  const pad = { top: 22, right: 22, bottom: 34, left: 48 }
  const visibleModels = models.filter((model) => !hidden.has(modelKey(model)))
  const visibleKeys = new Set(visibleModels.map(modelKey))
  const visibleSamples = samples.filter((sample) => visibleKeys.has(sampleKey(sample)))
  const validSamples = visibleSamples.filter((sample) => typeof sample[metric] === 'number')
  const values = validSamples.map((sample) => sample[metric]).filter((value): value is number => typeof value === 'number')
  const times = visibleSamples.map((sample) => new Date(sample.checkedAt).getTime()).filter(Number.isFinite)
  const minTime = times.length ? Math.min(...times) : Date.now()
  const maxTime = times.length ? Math.max(...times) : minTime + 60 * 60 * 1000
  const maxValue = values.length ? Math.max(...values) : 1
  const minValue = globalScale ? 0 : Math.min(0, ...values)
  const yMax = Math.max(maxValue * 1.08, 1)
  const xSpan = Math.max(maxTime - minTime, 1)
  const ySpan = Math.max(yMax - minValue, 1)
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  function x(checkedAt: string): number {
    return pad.left + ((new Date(checkedAt).getTime() - minTime) / xSpan) * plotW
  }

  function y(value: number): number {
    return pad.top + (1 - (value - minValue) / ySpan) * plotH
  }

  function toggleModel(key: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const series = visibleModels.map((model) => {
    const key = modelKey(model)
    const modelSamples = samples
      .filter((sample) => sampleKey(sample) === key)
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
    const points = modelSamples
      .filter((sample) => typeof sample[metric] === 'number')
      .map((sample) => `${x(sample.checkedAt)},${y(sample[metric] as number)}`)
    return {
      key,
      model,
      color: providerColors[model.providerId] ?? '#5FB8CE',
      path: points.length > 0 ? `M ${points.join(' L ')}` : '',
      failures: modelSamples.filter((sample) => sample.status !== 'ok'),
    }
  })

  return (
    <div className="trend-chart-card">
      <div className="trend-chart-head">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <span className="trend-chart-scale">{t(globalScale ? 'trend.scale.global' : 'trend.scale.local')}</span>
      </div>
      <div className="trend-chart-scroll">
        <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} className="chart-axis" />
          <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} className="chart-axis" />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const gridY = pad.top + ratio * plotH
            const labelValue = yMax - ratio * ySpan
            return (
              <g key={ratio}>
                <line x1={pad.left} y1={gridY} x2={width - pad.right} y2={gridY} className="chart-grid" />
                <text x={pad.left - 10} y={gridY + 4} className="chart-label" textAnchor="end">
                  {formatMetric(labelValue, metric)}
                </text>
              </g>
            )
          })}
          <text x={pad.left} y={height - 10} className="chart-label" textAnchor="start">
            {new Date(minTime).toLocaleDateString()}
          </text>
          <text x={width - pad.right} y={height - 10} className="chart-label" textAnchor="end">
            {new Date(maxTime).toLocaleDateString()}
          </text>
          {series.map((item) => (
            <g key={item.key} className="chart-series">
              {item.path ? (
                <path d={item.path} fill="none" stroke={item.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <title>{item.model.modelId}</title>
                </path>
              ) : null}
              {item.failures.map((sample) => (
                <circle
                  key={`${item.key}:${sample.checkedAt}:${sample.status}`}
                  cx={x(sample.checkedAt)}
                  cy={height - pad.bottom}
                  r="3"
                  className="chart-failure-dot"
                >
                  <title>{`${item.model.modelId} ${sample.status}`}</title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="trend-legend">
        {models.map((model) => {
          const key = modelKey(model)
          const isHidden = hidden.has(key)
          return (
            <button
              key={key}
              type="button"
              className={`trend-legend-item ${isHidden ? 'muted' : ''}`}
              onClick={() => toggleModel(key)}
              title={model.modelId}
            >
              <span style={{ '--series-color': providerColors[model.providerId] ?? '#5FB8CE' } as CSSProperties} />
              {model.modelId}
            </button>
          )
        })}
      </div>
    </div>
  )
}
