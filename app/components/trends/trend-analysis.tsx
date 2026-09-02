'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n'
import { useCountUp } from '@/lib/use-count-up'
import type { ModelTrendStats, TrendMetricKey, TrendResponse, TrendSample } from '@/domain/trend'
import {
  collectHoverRowsAtIndex,
  formatTrendModelName,
  selectPreferredTrendModelsForLiveRanking,
  selectTrendModelsForLiveRanking,
} from '@/domain/trend-view'
import type { LiveRankedModelRef } from '@/domain/trend-view'

type TrendAnalysisProps = {
  trends: TrendResponse
  liveModels: LiveRankedModelRef[]
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

export default function TrendAnalysis({ trends, liveModels }: TrendAnalysisProps) {
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

  // 性能趋势的模型集合与实时概览/模型排行保持一致：以实时排行前十为准，只过滤掉尚无趋势数据的模型。
  const topModels = useMemo(
    () => selectTrendModelsForLiveRanking(trends.modelStats, liveModels, TREND_MODEL_LIMIT),
    [trends.modelStats, liveModels],
  )
  const chartModels = useMemo(
    () => selectPreferredTrendModelsForLiveRanking(trends.modelStats, liveModels, CHART_SERIES_LIMIT),
    [trends.modelStats, liveModels],
  )

  const topModel = topModels[0] ?? null
  const mostStableModel = useMemo(() => {
    return [...topModels].sort((a, b) => {
      if (a.successRate !== b.successRate) return b.successRate - a.successRate
      return compareMetricValues(a.p95.ttftMs, b.p95.ttftMs, true)
    })[0] ?? null
  }, [topModels])

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

  if (topModels.length === 0) {
    return (
      <section className="trend-section">
        <div className="empty-state trend-empty">
          <span className="empty-icon">⌁</span>
          <strong>{t('trend.empty.title')}</strong>
          <span>{t('trend.empty.noLiveModels')}</span>
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
          value={topModels.length}
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
          models={chartModels}
          metric={metric}
          hidden={hidden}
          onToggleModel={toggleModel}
          rangeDays={trends.rangeDays}
        />
      ) : (
        <div className="trend-pending">
          <strong>{t('trend.pending.title')}</strong>
          <span>{t('trend.pending.desc', { count: sampledDayCount })}</span>
          <AccumMeter days={sampledDayCount} />
        </div>
      )}

      <TrendStatsTable key={metric} models={topModels} metric={metric} option={option} />
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
      {models.map((model) => (
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
  name: string
  model: ModelTrendStats
  color: string
  pts: ChartPoint[]
}

/* 图表渲染参数对齐设计稿 L926：viewBox 780×320，padL=56 / padR=20 / padT=22 / padB=40 */
const CHART_W = 780
const CHART_H = 320
const CHART_PAD = { top: 22, right: 20, bottom: 40, left: 56 }

/** 设计稿 L865-869：按模型（非厂商）取色，最多 10 条曲线。 */
const SERIES_COLORS = [
  'var(--lat-fast)', 'var(--cyan)', 'var(--accent)', 'var(--purple)', 'var(--lat-mid)',
  'var(--prov-bai)', 'var(--lat-slow)', 'color-mix(in oklch, var(--cyan) 55%, var(--accent))',
  'color-mix(in oklch, var(--green) 50%, var(--cyan))', 'color-mix(in oklch, var(--purple) 55%, var(--accent))',
]
const TREND_MODEL_LIMIT = 10
const CHART_SERIES_LIMIT = 10
const HOUR_LABELS = ['00', '03', '06', '09', '12', '15', '18', '21', '23']

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function TrendChart({ title, subtitle, samples, models, metric, hidden, onToggleModel, rangeDays }: {
  title: string
  subtitle: string
  samples: TrendSample[]
  models: ModelTrendStats[]
  metric: TrendMetricKey
  hidden: Set<string>
  onToggleModel: (key: string) => void
  rangeDays: number
}) {
  const { t } = useI18n()
  const option = getMetricOption(metric)
  const [hover, setHover] = useState<{ index: number; bestKey: string | null } | null>(null)

  const series = useMemo<ChartSeries[]>(() => {
    return models.map((model, index) => {
      const key = modelKey(model)
      const modelSamples = samples.filter((sample) => sampleKey(sample) === key)
      const pts: ChartPoint[] = []
      for (const sample of modelSamples) {
        const value = sample[metric]
        const time = new Date(sample.checkedAt).getTime()
        if (typeof value === 'number' && Number.isFinite(value) && Number.isFinite(time)) {
          pts.push({ t: time, v: value })
        }
      }
      pts.sort((a, b) => a.t - b.t)
      return {
        key,
        name: formatTrendModelName(model),
        model,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        pts,
      }
    })
  }, [models, samples, metric])

  const visibleSeries = useMemo(() => series.filter((item) => !hidden.has(item.key)), [series, hidden])
  const hasRenderableSeries = visibleSeries.some((item) => item.pts.length > 0)

  // 吸附/刻度按采样点 index 对齐：同一 index 下展示所有可见曲线的数据，不要求 checkedAt 完全一致。
  const maxPointCount = useMemo(() => {
    return visibleSeries.reduce((max, item) => Math.max(max, item.pts.length), 0)
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
  const ySpan = Math.max(maxV - minV, 1)
  const lastIndex = Math.max(maxPointCount - 1, 1)

  // 设计稿按采样点均匀铺满 x 轴（xAt(i)），而不是按真实时间间隔拉伸。
  function xAt(index: number): number {
    return CHART_PAD.left + (plotW * index) / lastIndex
  }

  function y(value: number): number {
    return CHART_PAD.top + (1 - (value - minV) / ySpan) * plotH
  }

  // hover：吸附最近采样时刻 + 最近的曲线（设计稿 attachHover L1023-1062）
  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (maxPointCount === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const sx = ((event.clientX - rect.left) / rect.width) * CHART_W
    const sy = ((event.clientY - rect.top) / rect.height) * CHART_H
    if (sx < CHART_PAD.left - 6 || sx > CHART_W - CHART_PAD.right + 6) {
      setHover(null)
      return
    }
    const rawIndex = ((sx - CHART_PAD.left) / plotW) * lastIndex
    const index = Math.max(0, Math.min(maxPointCount - 1, Math.round(rawIndex)))
    let bestKey: string | null = null
    let bestDy = Infinity
    for (const item of visibleSeries) {
      const point = item.pts[index]
      if (!point) continue
      const dy = Math.abs(y(point.v) - sy)
      if (dy < bestDy) {
        bestDy = dy
        bestKey = item.key
      }
    }
    setHover((prev) => (prev && prev.index === index && prev.bestKey === bestKey ? prev : { index, bestKey }))
  }

  // hidden 变化后 hover.index 可能越界，做边界防护
  const hoverIndex = hover && hover.index < maxPointCount ? hover.index : null
  const tipRows = useMemo(() => {
    if (hoverIndex == null) return []
    return collectHoverRowsAtIndex(visibleSeries, hoverIndex, metric)
  }, [visibleSeries, hoverIndex, metric])
  const hoverTime = tipRows[0]?.time ?? null

  const hoverBest = hoverIndex != null ? tipRows.find((row) => row.key === hover?.bestKey) ?? null : null

  function seriesLineOpacity(key: string): number {
    if (hoverTime == null || !hover?.bestKey) return 1
    return key === hover.bestKey ? 1 : 0.22
  }

  function seriesEndOpacity(key: string): number {
    if (hoverTime == null || !hover?.bestKey) return 1
    return key === hover.bestKey ? 1 : 0.28
  }

  // x 轴刻度对齐设计稿：固定 00/03/.../23 的 9 个小时标签。
  const tickLabels = useMemo(() => HOUR_LABELS.map((hour) => ({
    hour,
    index: Math.round((Number.parseInt(hour, 10) / 23) * lastIndex),
  })), [lastIndex])

  let crossX: number | null = null
  let crossY: number | null = null
  let tipStyle: CSSProperties | undefined
  if (hoverIndex != null) {
    crossX = xAt(hoverIndex)
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
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <span className="range-chip">{t('trend.scale.global')}</span>
      </div>
      {hasRenderableSeries ? <div className="chart-cover">
          <svg
            className="trend-chart chart-anim"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            role="img"
            aria-label={title}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const gridY = CHART_PAD.top + ratio * plotH
              const labelValue = maxV - ratio * ySpan
              return (
                <g key={ratio}>
                  <line x1={CHART_PAD.left} y1={gridY} x2={CHART_W - CHART_PAD.right} y2={gridY} className="chart-grid" />
                  <text x={CHART_PAD.left - 9} y={gridY + 3} className="chart-label" textAnchor="end">
                    {Math.round(labelValue)}
                  </text>
                </g>
              )
            })}
            {tickLabels.map(({ hour, index }) => (
              <text
                key={hour}
                x={xAt(index)}
                y={CHART_H - CHART_PAD.bottom + 18}
                className="chart-label"
                textAnchor="middle"
              >
                {`${hour}:00`}
              </text>
            ))}
            <line x1={CHART_PAD.left} y1={CHART_PAD.top} x2={CHART_PAD.left} y2={CHART_H - CHART_PAD.bottom} className="chart-axis" />
            <line x1={CHART_PAD.left} y1={CHART_H - CHART_PAD.bottom} x2={CHART_W - CHART_PAD.right} y2={CHART_H - CHART_PAD.bottom} className="chart-axis" />
            <rect x={CHART_PAD.left} y={CHART_PAD.top} width={plotW} height={plotH} fill="transparent" />
            {/* 设计稿 L965：best（越低越好的最优曲线）最后绘制、叠在最上层 */}
            {[...visibleSeries].reverse().map((item) => {
              const points = item.pts.map((point, index) => ({ x: xAt(index), y: y(point.v) }))
              const last = item.pts[item.pts.length - 1]
              return (
                <g key={item.key} className="chart-series">
                  {points.length > 0 ? (
                    <path
                      className="series-line"
                      d={smoothPath(points)}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="1.35"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: seriesLineOpacity(item.key) }}
                    >
                      <title>{item.name}</title>
                    </path>
                  ) : null}
                  {last ? (
                    <circle
                      className="series-end"
                      cx={xAt(item.pts.length - 1)}
                      cy={y(last.v)}
                      r="2.2"
                      fill={item.color}
                      stroke="var(--bg)"
                      strokeWidth="1.5"
                      style={{ opacity: seriesEndOpacity(item.key) }}
                    />
                  ) : null}

                </g>
              )
            })}
            {hoverIndex != null && crossX != null ? (
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
          {hoverIndex != null && tipStyle ? (
            <div className="chart-tip show" role="presentation" style={tipStyle}>
              <div className="tip-head">
                <em>{t(option.shortLabelKey)}</em>
                <span>{hoverTime == null ? '—' : formatClock(hoverTime)}</span>
              </div>
              {tipRows.map((row) => (
                <div className="tip-row" key={row.key}>
                  <i style={{ '--series': row.color } as CSSProperties} />
                  <span className="tip-name" title={row.name}>{row.name}</span>
                  <b>{formatMetric(row.value, metric)}<small>{option.unit}</small></b>
                </div>
              ))}
            </div>
          ) : null}
      </div> : <div className="empty-state trend-chart-empty"><span className="empty-icon">⌁</span><span>{t('trend.empty.noMetric')}</span></div>}
      <div className="chart-legend">
        {models.map((model, index) => {
          const key = modelKey(model)
          const isHidden = hidden.has(key)
          const displayName = formatTrendModelName(model)
          return (
            <button
              key={key}
              type="button"
              className={`legend-item ${isHidden ? 'off' : ''}`}
              onClick={() => onToggleModel(key)}
              aria-pressed={!isHidden}
              aria-label={displayName}
              title={displayName}
            >
              <i style={{ '--series': SERIES_COLORS[index % SERIES_COLORS.length] } as CSSProperties} />
              <span className="legend-label">{displayName}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
