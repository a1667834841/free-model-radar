'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n'
import { useCountUp } from '@/lib/use-count-up'
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
  /** 指标维度说明（设计稿 dimLabel，如“首字耗时 TTFT · 越低越好”）。 */
  dimLabelKey: MessageKey
  /** 设计稿 chartTitle：随指标整体变化（L900-902 dimMeta.title）。 */
  titleKey: MessageKey
}

const METRIC_OPTIONS: MetricOption[] = [
  {
    key: 'ttftMs',
    labelKey: 'trend.metric.ttft',
    shortLabelKey: 'trend.metric.ttftShort',
    unit: 'ms',
    lowerIsBetter: true,
    dimLabelKey: 'trend.dim.ttft',
    titleKey: 'trend.chart.title.ttft',
  },
  {
    key: 'tokensPerSec',
    labelKey: 'trend.metric.tps',
    shortLabelKey: 'trend.metric.tpsShort',
    unit: 't/s',
    lowerIsBetter: false,
    dimLabelKey: 'trend.dim.tps',
    titleKey: 'trend.chart.title.tps',
  },
  {
    key: 'latencyMs',
    labelKey: 'trend.metric.e2e',
    shortLabelKey: 'trend.metric.e2eShort',
    unit: 'ms',
    lowerIsBetter: true,
    dimLabelKey: 'trend.dim.e2e',
    titleKey: 'trend.chart.title.e2e',
  },
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

/** x 轴刻度标签：短窗口用 HH:00，长窗口用 MM-DD（设计稿 L953-958 的时间语义适配版）。 */
function formatTickLabel(ts: number, rangeDays: number): string {
  const d = new Date(ts)
  if (rangeDays <= 1) return `${String(d.getHours()).padStart(2, '0')}:00`
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  // 图例隐藏状态提升到此处：跨指标切换保留（设计稿 hidden 为模块级，不随 dim 重置）
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const toggleModel = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
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
          value={topModel ? topModel.median[metric] : null}
          unit={topModel ? option.unit : ''}
          detail={topModel ? topModel.modelId : '—'}
          tone="green"
        />
        <TrendSummaryCard
          label={t('trend.summary.stability')}
          value={mostStableModel ? Math.round(mostStableModel.successRate * 100) : null}
          unit={mostStableModel ? '%' : ''}
          detail={mostStableModel ? mostStableModel.modelId : '—'}
          tone="cyan"
        />
        <TrendSummaryCard
          label={t('trend.summary.models')}
          value={trends.modelStats.length}
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
        <span className="trend-hint">{t(option.dimLabelKey)}</span>
      </div>

      {canShowTrendCharts ? (
        <TrendChart
          title={t(option.titleKey)}
          subtitle={t('trend.chart.allModelsSub')}
          samples={trends.samples}
          models={rankedModels}
          metric={metric}
          providerColors={providerColors}
          hidden={hidden}
          onToggleModel={toggleModel}
          rangeDays={trends.rangeDays}
          globalScale
        />
      ) : (
        <div className="trend-pending">
          <strong>{t('trend.pending.title')}</strong>
          <span>{t('trend.pending.desc', { count: sampledDayCount })}</span>
          <AccumMeter days={sampledDayCount} />
        </div>
      )}

      <TrendStatsTable key={metric} models={rankedModels} metric={metric} option={option} />

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
                  title={`${provider.providerName} · ${t(option.labelKey)}`}
                  subtitle={t('trend.chart.providerSub')}
                  samples={trends.samples.filter((sample) => sample.providerId === provider.providerId)}
                  models={provider.models}
                  metric={metric}
                  providerColors={providerColors}
                  hidden={hidden}
                  onToggleModel={toggleModel}
                  rangeDays={trends.rangeDays}
                />
              ) : (
                <div className="trend-pending provider-pending">
                  <strong>{t('trend.pending.title')}</strong>
                  <span>{t('trend.pending.desc', { count: sampledDayCount })}</span>
                  <AccumMeter days={sampledDayCount} />
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
  value: number | null
  unit?: string
  detail: string
  tone: 'green' | 'cyan' | 'amber'
}) {
  // 设计稿 tsum strong[data-count]：整数值滚动动画（formatCount 无千分位）
  const display = useCountUp(value ?? 0)
  return (
    <article className={`trend-summary ${tone}`}>
      <span>{label}</span>
      <strong>{value == null ? '—' : display}{unit ? <small>{unit}</small> : null}</strong>
      <em>{detail}</em>
    </article>
  )
}

/** 趋势积累进度条（设计稿 L729-733、L331-334 的 accum-meter）。 */
function AccumMeter({ days }: { days: number }) {
  const { t } = useI18n()
  const pct = Math.max(0, Math.min(100, (days / 2) * 100))
  return (
    <div className="accum-meter">
      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
      <em>{t('trend.accum.days', { count: days })}</em>
    </div>
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

type ChartPoint = { t: number; v: number }

type ChartSeries = {
  key: string
  model: ModelTrendStats
  color: string
  pts: ChartPoint[]
  valueByTime: Map<number, number>
  failures: TrendSample[]
}

/* 图表渲染参数对齐设计稿 L926：viewBox 780×320，padL=56 / padR=20 / padT=22 / padB=40 */
const CHART_W = 780
const CHART_H = 320
const CHART_PAD = { top: 22, right: 20, bottom: 40, left: 56 }

function TrendChart({ title, subtitle, samples, models, metric, providerColors, hidden, onToggleModel, rangeDays, globalScale = false }: {
  title: string
  subtitle: string
  samples: TrendSample[]
  models: ModelTrendStats[]
  metric: TrendMetricKey
  providerColors: Record<string, string>
  hidden: Set<string>
  onToggleModel: (key: string) => void
  rangeDays: number
  globalScale?: boolean
}) {
  const { t } = useI18n()
  const option = getMetricOption(metric)
  const [hover, setHover] = useState<{ index: number; bestKey: string | null } | null>(null)

  const series = useMemo<ChartSeries[]>(() => {
    return models.map((model) => {
      const key = modelKey(model)
      const modelSamples = samples.filter((sample) => sampleKey(sample) === key)
      const pts: ChartPoint[] = []
      const valueByTime = new Map<number, number>()
      for (const sample of modelSamples) {
        const value = sample[metric]
        const time = new Date(sample.checkedAt).getTime()
        if (typeof value === 'number' && Number.isFinite(value) && Number.isFinite(time)) {
          pts.push({ t: time, v: value })
          valueByTime.set(time, value)
        }
      }
      pts.sort((a, b) => a.t - b.t)
      return {
        key,
        model,
        color: providerColors[model.providerId] ?? '#5FB8CE',
        pts,
        valueByTime,
        failures: modelSamples.filter((sample) => sample.status !== 'ok'),
      }
    })
  }, [models, samples, metric, providerColors])

  const visibleSeries = useMemo(() => series.filter((item) => !hidden.has(item.key)), [series, hidden])

  // 吸附/刻度用的采样时刻集合（可见曲线）
  const times = useMemo(() => {
    const set = new Set<number>()
    for (const item of visibleSeries) for (const point of item.pts) set.add(point.t)
    return Array.from(set).sort((a, b) => a - b)
  }, [visibleSeries])

  // Y 轴按全部数据（含隐藏曲线）计算，min/max ± 12% padding、不从 0 起（设计稿 L930-938）
  const { minV, maxV } = useMemo(() => {
    let mn = Infinity
    let mx = -Infinity
    for (const item of series) {
      for (const point of item.pts) {
        if (point.v < mn) mn = point.v
        if (point.v > mx) mx = point.v
      }
    }
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) return { minV: 0, maxV: 1 }
    if (mx === mn) mx = mn * 1.2 || 1
    const padv = (mx - mn) * 0.12
    const hi = mx + padv
    const lo = mn > 0 ? Math.max(0, mn - padv * 0.5) : mn - padv
    return { minV: lo, maxV: hi }
  }, [series])

  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom
  const minTime = times.length ? times[0] : Date.now()
  const maxTime = times.length ? times[times.length - 1] : minTime + 60 * 60 * 1000
  const xSpan = Math.max(maxTime - minTime, 1)
  const ySpan = Math.max(maxV - minV, 1)

  function x(time: number): number {
    return CHART_PAD.left + ((time - minTime) / xSpan) * plotW
  }

  function y(value: number): number {
    return CHART_PAD.top + (1 - (value - minV) / ySpan) * plotH
  }

  // hover：吸附最近采样时刻 + 最近的曲线（设计稿 attachHover L1023-1062）
  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (times.length === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const sx = ((event.clientX - rect.left) / rect.width) * CHART_W
    const sy = ((event.clientY - rect.top) / rect.height) * CHART_H
    if (sx < CHART_PAD.left - 6 || sx > CHART_W - CHART_PAD.right + 6) {
      setHover(null)
      return
    }
    const timeAtX = minTime + ((sx - CHART_PAD.left) / plotW) * xSpan
    let index = 0
    let bestDt = Infinity
    for (let i = 0; i < times.length; i += 1) {
      const dt = Math.abs(times[i] - timeAtX)
      if (dt < bestDt) {
        bestDt = dt
        index = i
      }
    }
    const time = times[index]
    let bestKey: string | null = null
    let bestDy = Infinity
    for (const item of visibleSeries) {
      const value = item.valueByTime.get(time)
      if (value == null) continue
      const dy = Math.abs(y(value) - sy)
      if (dy < bestDy) {
        bestDy = dy
        bestKey = item.key
      }
    }
    setHover((prev) => (prev && prev.index === index && prev.bestKey === bestKey ? prev : { index, bestKey }))
  }

  // hidden 变化后 hover.index 可能越界，做边界防护
  const hoverIndex = hover && hover.index < times.length ? hover.index : null
  const hoverTime = hoverIndex == null ? null : times[hoverIndex]
  const tipRows = useMemo(() => {
    if (hoverTime == null) return []
    return visibleSeries
      .map((item) => ({ item, value: item.valueByTime.get(hoverTime) }))
      .filter((row): row is { item: ChartSeries; value: number } => typeof row.value === 'number')
      .sort((a, b) => b.value - a.value)
  }, [visibleSeries, hoverTime])

  const hoverBest = hoverTime != null ? tipRows.find((row) => row.item.key === hover?.bestKey) ?? null : null

  function seriesLineOpacity(key: string): number {
    if (hoverTime == null || !hover?.bestKey) return 1
    return key === hover.bestKey ? 1 : 0.22
  }

  function seriesEndOpacity(key: string): number {
    if (hoverTime == null || !hover?.bestKey) return 1
    return key === hover.bestKey ? 1 : 0.28
  }

  // x 轴刻度：均匀取点，密度 5-9 个（设计稿 9 个 HH:00 标签的时间语义适配）
  const tickIndices = useMemo(() => {
    if (times.length === 0) return []
    const wanted = Math.min(times.length, 9)
    return Array.from(new Set(
      Array.from({ length: wanted }, (_, k) => Math.round((k * (times.length - 1)) / Math.max(wanted - 1, 1))),
    ))
  }, [times])

  let crossX: number | null = null
  let crossY: number | null = null
  let tipStyle: CSSProperties | undefined
  if (hoverTime != null) {
    crossX = x(hoverTime)
    crossY = hoverBest ? y(hoverBest.value) - 10 : CHART_PAD.top + plotH / 2
    const half = 118 // 设计稿 L1052：tooltip 半高，保证上下不越界
    const clampedY = Math.max(CHART_PAD.top + half, Math.min(CHART_H - CHART_PAD.bottom - half, crossY))
    tipStyle = {
      left: `${(crossX / CHART_W) * 100}%`,
      top: `${(clampedY / CHART_H) * 100}%`,
      // 边界翻转：采样点偏右时 tooltip 翻到左侧（设计稿 L1051-1061）
      transform: crossX < CHART_W * 0.6 ? 'translate(0, -50%)' : 'translate(-100%, -50%)',
    }
  }

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
        <div className="chart-cover">
          <svg
            className="trend-chart"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            role="img"
            aria-label={title}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          >
            <line x1={CHART_PAD.left} y1={CHART_PAD.top} x2={CHART_PAD.left} y2={CHART_H - CHART_PAD.bottom} className="chart-axis" />
            <line x1={CHART_PAD.left} y1={CHART_H - CHART_PAD.bottom} x2={CHART_W - CHART_PAD.right} y2={CHART_H - CHART_PAD.bottom} className="chart-axis" />
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const gridY = CHART_PAD.top + ratio * plotH
              const labelValue = maxV - ratio * ySpan
              return (
                <g key={ratio}>
                  <line x1={CHART_PAD.left} y1={gridY} x2={CHART_W - CHART_PAD.right} y2={gridY} className="chart-grid" />
                  <text x={CHART_PAD.left - 9} y={gridY + 3} className="chart-label" textAnchor="end">
                    {formatMetric(labelValue, metric)}
                  </text>
                </g>
              )
            })}
            {tickIndices.map((index) => (
              <text
                key={times[index]}
                x={x(times[index])}
                y={CHART_H - CHART_PAD.bottom + 18}
                className="chart-label"
                textAnchor="middle"
              >
                {formatTickLabel(times[index], rangeDays)}
              </text>
            ))}
            {visibleSeries.map((item) => {
              const points = item.pts.map((point) => `${x(point.t).toFixed(1)},${y(point.v).toFixed(1)}`)
              const last = item.pts[item.pts.length - 1]
              return (
                <g key={item.key} className="chart-series">
                  {points.length > 0 ? (
                    <path
                      className="series-line"
                      d={`M ${points.join(' L ')}`}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: seriesLineOpacity(item.key) }}
                    >
                      <title>{item.model.modelId}</title>
                    </path>
                  ) : null}
                  {last ? (
                    <circle
                      className="series-end"
                      cx={x(last.t)}
                      cy={y(last.v)}
                      r="3"
                      fill={item.color}
                      stroke="var(--bg)"
                      strokeWidth="1.5"
                      style={{ opacity: seriesEndOpacity(item.key) }}
                    />
                  ) : null}
                  {item.failures.map((sample) => (
                    <circle
                      key={`${item.key}:${sample.checkedAt}:${sample.status}`}
                      cx={x(new Date(sample.checkedAt).getTime())}
                      cy={CHART_H - CHART_PAD.bottom}
                      r="3"
                      className="chart-failure-dot"
                    >
                      <title>{`${item.model.modelId} ${sample.status}`}</title>
                    </circle>
                  ))}
                </g>
              )
            })}
            {hoverTime != null && crossX != null ? (
              <>
                <line className="chart-cross" x1={crossX} y1={CHART_PAD.top} x2={crossX} y2={CHART_H - CHART_PAD.bottom} strokeWidth="1" />
                {hoverBest ? (
                  <line
                    className="chart-cross"
                    x1={CHART_PAD.left}
                    y1={y(hoverBest.value)}
                    x2={CHART_W - CHART_PAD.right}
                    y2={y(hoverBest.value)}
                    strokeWidth="1"
                  />
                ) : null}
              </>
            ) : null}
          </svg>
          {hoverTime != null && tipStyle ? (
            <div className="chart-tip show" role="presentation" style={tipStyle}>
              <div className="tip-head">
                <em>{t(option.shortLabelKey)}</em>
                <span>{formatClock(hoverTime)}</span>
              </div>
              {tipRows.map((row) => (
                <div className="tip-row" key={row.item.key}>
                  <i style={{ '--series': row.item.color } as CSSProperties} />
                  <span className="tip-name">{row.item.model.modelId}</span>
                  <b>{formatMetric(row.value, metric)}<small>{option.unit}</small></b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
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
              onClick={() => onToggleModel(key)}
              aria-pressed={!isHidden}
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
