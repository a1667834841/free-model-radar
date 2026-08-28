'use client'

import { useState, useMemo } from 'react'
import { useI18n } from './i18n'
import RefreshButton from './refresh-button'
import ModelEvaluation from './components/evaluation/model-evaluation'
import TrendAnalysis from './components/trends/trend-analysis'
import type { ProviderResult, ModelResult } from '@/domain/result'
import type { TrendResponse } from '@/domain/trend'
import {
  DEFAULT_EVALUATION_METHOD_ID,
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
  trends: TrendResponse
  isAdmin: boolean
  nodeGeo: { city: string | null; country: string | null; region: string | null; ip: string | null }
}

const PROVIDER_COLORS = ['#F0A35E', '#5FB8CE', '#A78BFA', '#E879A8', '#7FBF6A', '#D8C07A', '#62B8A0', '#E59A8C']

const TTFT_TIER = [
  { max: 500, color: '#3FCF8E', label: 'fast' },
  { max: 1500, color: '#E8B44C', label: 'mid' },
  { max: Infinity, color: '#E2625F', label: 'slow' },
] as const

function getTtftColor(ms: number): string {
  for (const tier of TTFT_TIER) {
    if (ms <= tier.max) return tier.color
  }
  return '#E2625F'
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

function getProviderHomeUrl(baseUrl?: string): string | null {
  if (!baseUrl) return null
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

export default function Dashboard({ providers, models, updatedAt, isStale, refreshStatus, trends, isAdmin, nodeGeo }: DashboardProps) {
  const { t, locale, setLocale } = useI18n()
  const [pageView, setPageView] = useState<'overview' | 'trends'>('overview')
  const [modelView, setModelView] = useState<'ranking' | 'provider'>('ranking')

  const evaluationMethod = getEvaluationMethod(DEFAULT_EVALUATION_METHOD_ID)
  const rankedModels = useMemo(() => evaluationMethod.rank(models), [models, evaluationMethod])
  const topModel = rankedModels[0] ?? null

  const { globalMinTtft, globalMaxTtft, providerOverview, providerColors } = useMemo(() => {
    const ttftValues = models.map((m) => resolveStreamingMetrics(m).ttftMs)
    const gMin = ttftValues.length ? Math.min(...ttftValues) : 0
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

    return { globalMinTtft: gMin, globalMaxTtft: gMax, providerOverview: overview, providerColors: colors }
  }, [providers, models])

  const ttftRange = Math.max(globalMaxTtft - globalMinTtft, 1)

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 8.6a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55"/>
              <path d="M8 9.3a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".28"/>
              <text x="12" y="17" textAnchor="middle" fontSize="9" fontWeight="900" fill="currentColor" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif">FM</text>
            </svg>
          </span>
          <span className="brand-tagline">{t('brand.tagline')}</span>
        </div>
        <div className="topbar-controls">
          {nodeGeo && (nodeGeo.city || nodeGeo.country) && (
            <span className="geo-chip" title={t('node.edge')}>
              <span className="geo-dot" />
              {[nodeGeo.city, nodeGeo.country ? nodeGeo.country.toUpperCase() : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          <span className={`status-chip ${isStale ? 'stale' : 'fresh'}`}>
            <span className="status-dot" />
            {isStale ? t('data.stale') : t('data.fresh')}
          </span>
          {updatedAt && (
            <span className="topbar-ts">
              {t('data.lastRefresh')}：{formatRelative(updatedAt, locale)}
            </span>
          )}
          <div className="language-switch" role="group" aria-label={t('lang.toggle')}>
            <button
              className={`language-option ${locale === 'zh' ? 'active' : ''}`}
              onClick={() => setLocale('zh')}
              aria-pressed={locale === 'zh'}
            >
              中文
            </button>
            <button
              className={`language-option ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
            >
              EN
            </button>
          </div>
          <a
            className="github-link"
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
          {isAdmin ? <RefreshButton /> : null}
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="hero-eyebrow">{t('page.eyebrow')}</div>
          <h1 className="hero-title">{t('page.title')}</h1>
          <p className="hero-subtitle">{t('page.subtitle')}</p>
        </div>
      </section>

      <section className="metrics">
        <MetricCard
          label={t('metric.providers')}
          value={String(providers.length).padStart(2, '0')}
          detail={`${providers.filter((p) => p.status === 'healthy').length} ${t('status.healthy')}`}
          accent="amber"
        />
        <MetricCard
          label={t('metric.models')}
          value={String(models.length).padStart(2, '0')}
          detail={t('data.lastRefresh') + (updatedAt ? `: ${formatRelative(updatedAt, locale)}` : '—')}
          accent="cyan"
        />
        <MetricCard
          label={t('metric.fastestTtft')}
          value={topModel ? `${topModel.ttftMs ?? topModel.latencyMs}` : '--'}
          unit={topModel ? 'ms' : ''}
          detail={topModel ? topModel.id : '—'}
          accent="green"
        />
        <MetricCard
          label={t('metric.cycle')}
          value="1"
          unit="hr"
          detail={t('metric.last', { time: updatedAt ? formatRelative(updatedAt, locale) : '—' })}
          accent="purple"
        />
      </section>

      <div className="page-tabs" role="tablist" aria-label={t('page.tabs')}>
        <button
          type="button"
          className={`page-tab ${pageView === 'overview' ? 'active' : ''}`}
          onClick={() => setPageView('overview')}
          aria-pressed={pageView === 'overview'}
        >
          {t('page.tab.overview')}
        </button>
        <button
          type="button"
          className={`page-tab ${pageView === 'trends' ? 'active' : ''}`}
          onClick={() => setPageView('trends')}
          aria-pressed={pageView === 'trends'}
        >
          {t('page.tab.trends')}
        </button>
      </div>

      {pageView === 'overview' && providerOverview.length > 0 && (
        <section className="overview-section">
          <div className="section-header">
            <div>
              <span className="section-kicker">{t('overview.title')}</span>
              <span className="section-hint">{t('overview.sub')}</span>
            </div>
          </div>
          <div className="overview-list">
            {providerOverview.map((p) => {
              const color = providerColors[p.id]
              const homeUrl = getProviderHomeUrl(p.baseUrl)
              const leftPct = ttftRange > 0 && p.modelCount > 0 ? ((p.min - globalMinTtft) / ttftRange) * 100 : 0
              const widthPct = ttftRange > 0 && p.modelCount > 0 ? ((p.max - p.min) / ttftRange) * 100 : 0
              return (
                <div className="overview-row" key={p.id}>
                  <div className="overview-provider">
                    <span className="overview-dot" style={{ background: color }} />
                    {homeUrl ? (
                      <a
                        className="overview-name overview-link"
                        href={homeUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.name}
                      </a>
                    ) : (
                      <span className="overview-name">{p.name}</span>
                    )}
                    <span className={`overview-status ${p.status}`}>{t(`status.${p.status}` as any)}</span>
                  </div>
                  <div className="overview-bar-wrap">
                    {p.modelCount > 0 ? (
                      <span
                        className="overview-bar-fill"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 2)}%`,
                          background: widthPct > 8
                            ? `linear-gradient(90deg, ${getTtftColor(p.min)}, ${getTtftColor(p.max)})`
                            : getTtftColor(p.min),
                        }}
                      />
                    ) : (
                      <span className="overview-bar-empty" />
                    )}
                  </div>
                  <div className="overview-nums">
                    {p.modelCount > 0 ? (
                      <>
                        <span className="num-fast">{p.min}<small>ms</small></span>
                        <span className="num-sep">·</span>
                        <span className="num-mid">{p.median}<small>ms</small></span>
                        <span className="num-sep">·</span>
                        <span className="num-slow">{p.max}<small>ms</small></span>
                      </>
                    ) : (
                      <span className="num-na">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {pageView === 'overview' ? (
        <>
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
        </>
      ) : (
        <TrendAnalysis trends={trends} providerColors={providerColors} />
      )}

      {refreshStatus.error && (
        <div className="error-banner">{t('error.banner', { error: refreshStatus.error })}</div>
      )}

      <footer className="footer">
        <span className="footer-operational" title={t('footer.operationalHelp')}>
          <span className="status-dot" /> {t('footer.operational')}
        </span>
        <span className="footer-note">
          {t('footer.node')}
          {nodeGeo.ip ? ` · ${nodeGeo.ip}` : ''}
          {[nodeGeo.city, nodeGeo.country].filter(Boolean).length > 0
            ? ` · ${[nodeGeo.city, nodeGeo.country].filter(Boolean).join(', ')}`
            : ''}
        </span>
      </footer>
    </div>
  )
}

function MetricCard({ label, value, unit, detail, accent }: {
  label: string; value: string; unit?: string; detail: string; accent: string
}) {
  return (
    <article className={`metric-card ${accent}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}{unit ? <small>{unit}</small> : null}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  )
}
