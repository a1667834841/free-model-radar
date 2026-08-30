'use client'

import { useState, useMemo, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useI18n } from './i18n'
import { useCountUp } from '@/lib/use-count-up'
import { getProviderHomeUrl, getProviderIconUrl } from '@/lib/provider-icon'
import { getTtftColor, getTtftTierClass } from '@/lib/ttft-tier'
import RefreshButton from './refresh-button'
import ModelEvaluation from './components/evaluation/model-evaluation'
import TrendAnalysis from './components/trends/trend-analysis'
import type { ProviderResult, ModelResult } from '@/domain/result'
import type { TrendResponse } from '@/domain/trend'
import {
  DEFAULT_EVALUATION_METHOD_ID,
  findFastestTtftModel,
  getEvaluationMethod,
  resolveStreamingMetrics,
} from '@/domain/evaluation'
import type { RefreshStatus } from '@/domain/refresh'

type FlattenedModel = ModelResult & { providerId: string; providerName: string }

type DashboardProps = {
  providers: ProviderResult[]
  models: FlattenedModel[]
  updatedAt: string | null
  isStale: boolean
  refreshStatus: RefreshStatus
  trends: TrendResponse | null
  isAdmin: boolean
  nodeGeo: { city: string | null; country: string | null; region: string | null }
}

const PROVIDER_COLORS = ['#F0A35E', '#5FB8CE', '#A78BFA', '#E879A8', '#7FBF6A', '#D8C07A', '#62B8A0', '#E59A8C']

/** 数字滚动展示（设计稿 .kpi-big[data-count] 行为）。 */
function CountUpNumber({ value, pad = 0 }: { value: number; pad?: number }) {
  return <>{useCountUp(value, pad)}</>
}

function formatRelative(iso: string, locale: 'zh' | 'en'): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return locale === 'zh' ? '刚刚' : 'just now'
  if (minutes < 60) {
    const n = String(minutes)
    return locale === 'zh' ? `${n} 分钟前` : `${n} min ago`
  }
  const n = String(Math.floor(minutes / 60))
  return locale === 'zh' ? `${n} 小时前` : `${n} hr ago`
}

function getDataHealth(refreshStatus: RefreshStatus, isStale: boolean): {
  tone: 'fresh' | 'stale' | 'running' | 'failed'
  labelKey: 'data.fresh' | 'data.stale' | 'data.refreshing' | 'data.failed'
  footerKey: 'footer.operational' | 'footer.degraded' | 'footer.refreshing'
  footerHelpKey: 'footer.operationalHelp' | 'footer.degradedHelp' | 'footer.refreshingHelp'
} {
  if (refreshStatus.status === 'running') {
    return {
      tone: 'running',
      labelKey: 'data.refreshing',
      footerKey: 'footer.refreshing',
      footerHelpKey: 'footer.refreshingHelp',
    }
  }
  if (refreshStatus.status === 'failed' || refreshStatus.error) {
    return {
      tone: 'failed',
      labelKey: 'data.failed',
      footerKey: 'footer.degraded',
      footerHelpKey: 'footer.degradedHelp',
    }
  }
  if (isStale) {
    return {
      tone: 'stale',
      labelKey: 'data.stale',
      footerKey: 'footer.degraded',
      footerHelpKey: 'footer.degradedHelp',
    }
  }
  return {
    tone: 'fresh',
    labelKey: 'data.fresh',
    footerKey: 'footer.operational',
    footerHelpKey: 'footer.operationalHelp',
  }
}

export default function Dashboard({ providers, models, updatedAt, isStale, refreshStatus, trends, isAdmin, nodeGeo }: DashboardProps) {
  const { t, locale, setLocale } = useI18n()
  const [pageView, setPageView] = useState<'overview' | 'trends'>('overview')
  const [modelView, setModelView] = useState<'ranking' | 'provider'>('ranking')
  const [hydrated, setHydrated] = useState(false)
  const [trendData, setTrendData] = useState<TrendResponse | null>(trends)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)

  // 视图选择持久化（设计稿 L810-831）：SSR 下只在 effect 内读 localStorage，首帧固定 overview
  useEffect(() => {
    setHydrated(true)
    try {
      const saved = localStorage.getItem('model-eval-view')
      if (saved === 'overview' || saved === 'trends') setPageView(saved)
    } catch { /* localStorage 不可用时忽略 */ }
  }, [])

  function switchPageView(view: 'overview' | 'trends') {
    setPageView(view)
    try { localStorage.setItem('model-eval-view', view) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (pageView !== 'trends' || trendData || trendLoading) return
    let cancelled = false
    setTrendLoading(true)
    setTrendError(null)
    fetch('/api/trends')
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json() as TrendResponse
      })
      .then((data) => {
        if (!cancelled) setTrendData(data)
      })
      .catch((error) => {
        if (!cancelled) setTrendError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (!cancelled) setTrendLoading(false)
      })
    return () => { cancelled = true }
  }, [pageView, trendData, trendLoading])

  const evaluationMethod = useMemo(() => getEvaluationMethod(DEFAULT_EVALUATION_METHOD_ID), [])
  const liveRankedModels = useMemo(() => evaluationMethod.rank(models), [evaluationMethod, models])
  const fastestTtftModel = useMemo(() => findFastestTtftModel(models), [models])
  const fastestModel = useMemo(() => {
    if (!fastestTtftModel) return null
    return models.find((model) => {
      return model.id === fastestTtftModel.id && resolveStreamingMetrics(model).ttftMs === fastestTtftModel.ttftMs
    }) ?? null
  }, [fastestTtftModel, models])
  const dataHealth = getDataHealth(refreshStatus, isStale)
  const healthyProviders = providers.filter((p) => p.status === 'healthy').length

  const { globalMaxTtft, providerOverview, providerColors } = useMemo(() => {
    const ttftValues = models.map((m) => resolveStreamingMetrics(m).ttftMs)
    const gMax = ttftValues.length ? Math.max(...ttftValues) : 0

    const colors: Record<string, string> = {}
    providers.forEach((p, idx) => {
      colors[p.id] = PROVIDER_COLORS[idx % PROVIDER_COLORS.length]
    })

    const overview = providers
      .map((p) => {
        const ttfts = p.models.map((m) => resolveStreamingMetrics({ ...m, providerId: p.id, providerName: p.name }).ttftMs).sort((a, b) => a - b)
        if (ttfts.length === 0) {
          return { ...p, modelCount: 0, min: 0, max: 0, median: 0, ttfts: [] as number[] }
        }
        const mid = Math.floor(ttfts.length / 2)
        const median = ttfts.length % 2 === 0
          ? Math.round((ttfts[mid - 1] + ttfts[mid]) / 2)
          : ttfts[mid]
        return { ...p, modelCount: p.models.length, min: ttfts[0], max: ttfts[ttfts.length - 1], median, ttfts }
      })
      .sort((a, b) => {
        if (a.modelCount === 0 && b.modelCount === 0) return a.name.localeCompare(b.name)
        if (a.modelCount === 0) return 1
        if (b.modelCount === 0) return -1
        if (a.min !== b.min) return a.min - b.min
        return a.name.localeCompare(b.name)
      })

    return { globalMaxTtft: gMax, providerOverview: overview, providerColors: colors }
  }, [providers, models])

  // prov-scale 以 0 为基准归一化（设计稿 L488：左端固定 0 ms）
  const ttftScaleMax = Math.max(globalMaxTtft, 1)
  const fastestMeterPct = fastestTtftModel && globalMaxTtft > 0
    ? Math.max(8, Math.min(100, (fastestTtftModel.ttftMs / globalMaxTtft) * 100))
    : 0
  const providerHealthPct = providers.length > 0 ? (healthyProviders / providers.length) * 100 : 0
  const relativeUpdatedAt = hydrated && updatedAt ? formatRelative(updatedAt, locale) : '—'

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6.5h4.3M3 12h4.3M3 17.5h4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".48" />
              <path d="M7.3 6.5 14.4 12M7.3 12h7.1M7.3 17.5 14.4 12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M14.4 12H19.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="21.2" cy="12" r="1.9" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-tagline"><span className="brand-lite">free</span><span className="brand-strong">router</span></span>
        </div>
        <div className="topbar-controls">
          {nodeGeo && (nodeGeo.city || nodeGeo.country) && (
            <span className="chip geo" title={t('node.edge')}>
              <span className="pulse" />
              {[nodeGeo.city, nodeGeo.country ? nodeGeo.country.toUpperCase() : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          <span className={`chip ${dataHealth.tone}`}>
            <span className="pulse" />
            {t(dataHealth.labelKey)}
          </span>
          {updatedAt && (
            <span className="topbar-ts">
              {t('data.lastRefresh')} · {relativeUpdatedAt}
            </span>
          )}
          <div className="lang-switch" role="group" aria-label={t('lang.toggle')}>
            <button
              className={`lang-opt ${locale === 'zh' ? 'active' : ''}`}
              onClick={() => setLocale('zh')}
              aria-pressed={locale === 'zh'}
            >
              中文
            </button>
            <button
              className={`lang-opt ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
            >
              EN
            </button>
          </div>
          <a
            className="gh-link"
            href="https://github.com/a1667834841/free-model-radar"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="hero-eyebrow">{t('page.eyebrow')}</div>
          <h1 className="hero-title">{t('page.title')}</h1>
          <p className="hero-subtitle">{t('page.subtitle')}</p>
        </div>
        <div className="hero-cta">
          {isAdmin ? <RefreshButton /> : null}
          <a className="btn btn-ghost" href="/api/results" target="_blank" rel="noreferrer">{t('page.rawData')}</a>
        </div>
      </section>

      <section className="kpis">
        <article className="kpi-hero">
          <div className="kpi-hero-top">
            <span className="kpi-eyebrow">{t('metric.fastestTtft')} · {t('metric.fastest')}</span>
            <span className="kpi-status"><span className="dot" />1hr · {relativeUpdatedAt}</span>
          </div>
          <div>
            <div className="kpi-big">{fastestTtftModel ? <CountUpNumber value={fastestTtftModel.ttftMs} /> : '--'}{fastestTtftModel ? <small>ms</small> : null}</div>
            <div className="kpi-who">{fastestTtftModel ? `${fastestTtftModel.id}${fastestModel ? ` · ${fastestModel.providerName}` : ''}` : '—'}</div>
          </div>
          <div className="meter">
            <span className="meter-track"><span className="meter-fill accent" style={{ width: `${fastestMeterPct}%` }} /></span>
            <span className="meter-note">{t('badge.fastest')} · {models.length} {t('metric.models')}</span>
          </div>
        </article>
        <MetricCard
          label={t('metric.providers')}
          value={providers.length}
          pad={2}
          detail={`${healthyProviders} ${t('status.healthy')}`}
          meter={`${healthyProviders} / ${providers.length || 0}`}
          meterPct={providerHealthPct}
          tone="green"
        />
        <MetricCard
          label={t('metric.models')}
          value={models.length}
          pad={2}
          detail={t('data.lastRefresh') + (updatedAt ? ` · ${formatRelative(updatedAt, locale)}` : ' —')}
          meter={updatedAt ? t('metric.last', { time: formatRelative(updatedAt, locale) }) : '—'}
          meterPct={models.length > 0 ? 92 : 0}
          tone="cyan"
        />
      </section>

      <div className="tabs" role="tablist" aria-label={t('page.tabs')}>
        <button
          type="button"
          role="tab"
          data-view="overview"
          className={`tab ${pageView === 'overview' ? 'active' : ''}`}
          onClick={() => switchPageView('overview')}
          aria-selected={pageView === 'overview'}
        >
          {t('page.tab.overview')}
        </button>
        <button
          type="button"
          role="tab"
          data-view="trends"
          className={`tab ${pageView === 'trends' ? 'active' : ''}`}
          onClick={() => switchPageView('trends')}
          aria-selected={pageView === 'trends'}
        >
          {t('page.tab.trends')}
        </button>
      </div>

      <div className={`view ${pageView === 'overview' ? 'active' : ''}`}>
      {providerOverview.length > 0 && (
        <section className="section overview-section">
          <div className="section-head">
            <div className="section-title-inline">
              <span className="section-kicker">{t('overview.title')}</span>
              <i className="help-dot" data-tip={t('overview.sub')}>?</i>
            </div>
          </div>
          <div className="overview-list">
            {providerOverview.map((p, idx) => {
              const color = providerColors[p.id]
              const homeUrl = getProviderHomeUrl(p)
              const faviconUrl = getProviderIconUrl(p, homeUrl)
              const leftPct = p.modelCount > 0 ? (p.min / ttftScaleMax) * 100 : 0
              const widthPct = p.modelCount > 0 ? ((p.max - p.min) / ttftScaleMax) * 100 : 0
              const midPct = p.modelCount > 0 ? (p.median / ttftScaleMax) * 100 : 0
              return (
                <div className="prov-row" key={p.id} style={{ '--delay': `${Math.min(idx * 40, 320)}ms` } as CSSProperties}>
                  <div className="prov-id">
                    <span className="prov-fav" style={{ '--prov': color } as CSSProperties}>
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                        />
                      ) : null}
                    </span>
                    {homeUrl ? (
                      <a
                        className="prov-name"
                        href={homeUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.name}
                      </a>
                    ) : (
                      <span className="prov-name">{p.name}</span>
                    )}
                    <span className={`prov-status ${p.status}`}>{t(`status.${p.status}` as any)}</span>
                  </div>
                  <div className="prov-bar">
                    <div className="prov-track">
                      {p.modelCount > 0 ? (
                        <>
                          <span
                            className="prov-range"
                            style={{
                              '--lo': `${leftPct}%`,
                              '--wid': `${Math.max(widthPct, 2)}%`,
                              background: widthPct > 8
                                ? `linear-gradient(90deg, ${getTtftColor(p.min)}, ${getTtftColor(p.max)})`
                                : getTtftColor(p.min),
                            } as CSSProperties}
                          />
                          <span className="prov-mid" style={{ '--mid': `${midPct}%` } as CSSProperties} />
                        </>
                      ) : (
                        <span className="prov-empty" />
                      )}
                    </div>
                    <div className="prov-scale"><span>0 ms</span><span>{globalMaxTtft.toLocaleString()} ms</span></div>
                  </div>
                  <div className="prov-nums">
                    {p.modelCount > 0 ? (
                      <>
                        <span className={getTtftTierClass(p.min)}>{p.min.toLocaleString()}<small>ms</small></span>
                        <span className="prov-sep">·</span>
                        <span className={getTtftTierClass(p.median)}>{p.median.toLocaleString()}<small>ms</small></span>
                        <span className="prov-sep">·</span>
                        <span className={getTtftTierClass(p.max)}>{p.max.toLocaleString()}<small>ms</small></span>
                      </>
                    ) : (
                      <span className="prov-na">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="prov-legend">
            <span><i style={{ background: 'var(--lat-fast)' }} /><b>≤ P50</b></span>
            <span><i style={{ background: 'var(--lat-mid)' }} /><b>P50-P95</b></span>
            <span><i style={{ background: 'var(--lat-slow)' }} /><b>&gt; P95</b></span>
            <span><i style={{ background: 'color-mix(in oklch, var(--fg) 82%, transparent)' }} />{t('overview.median')}</span>
          </div>
        </section>
      )}

      <div className="view-toggle">
        <button
          type="button"
          className={`view-btn ${modelView === 'ranking' ? 'active' : ''}`}
          onClick={() => setModelView('ranking')}
          aria-pressed={modelView === 'ranking'}
        >
          {t('view.ranking')}
        </button>
        <button
          type="button"
          className={`view-btn ${modelView === 'provider' ? 'active' : ''}`}
          onClick={() => setModelView('provider')}
          aria-pressed={modelView === 'provider'}
        >
          {t('view.provider')}
        </button>
      </div>

      <ModelEvaluation
          models={models}
          providers={providers}
          view={modelView}
          providerColors={providerColors}
        />
      </div>

      <div className={`view ${pageView === 'trends' ? 'active' : ''}`}>
        {trendData ? (
          <TrendAnalysis trends={trendData} liveModels={liveRankedModels} />
        ) : (
          <section className="trend-section">
            <div className="empty-state trend-empty">
              <span className="empty-icon">⌁</span>
              <strong>{trendError ? '趋势加载失败' : '正在加载趋势'}</strong>
              <span>{trendError ? trendError : '趋势数据会在打开此页签时按需加载。'}</span>
            </div>
          </section>
        )}
      </div>

      {refreshStatus.error && (
        <div className="error-banner">{t('error.banner', { error: refreshStatus.error })}</div>
      )}

      <footer className="footer">
        <span className={`footer-operational ${dataHealth.tone}`} title={t(dataHealth.footerHelpKey)}>
          <span className="status-dot" /> {t(dataHealth.footerKey)}
        </span>
        <span className="footer-note">
          {t('footer.node')}
          {[nodeGeo.city, nodeGeo.country].filter(Boolean).length > 0
            ? ` · ${[nodeGeo.city, nodeGeo.country].filter(Boolean).join(', ')}`
            : ''}
        </span>
      </footer>
    </div>
  )
}

function MetricCard({ label, value, pad = 0, unit, detail, meter, meterPct, tone }: {
  label: string; value: number; pad?: number; unit?: string; detail: string; meter: string; meterPct: number; tone: 'green' | 'cyan'
}) {
  const display = useCountUp(value, pad)
  return (
    <article className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div>
        <div className="kpi-value">{display}{unit ? <small>{unit}</small> : null}</div>
        <div className="kpi-detail">{detail}</div>
      </div>
      <div className="meter">
        <span className="meter-track"><span className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, meterPct))}%`, background: `var(--${tone})` }} /></span>
        <span className="meter-note">{meter}</span>
      </div>
    </article>
  )
}
