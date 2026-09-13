'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SvgEvaluationPublicItem, SvgEvaluationPublicResponse } from '@/domain/svg-evaluation'
import { useI18n } from '../../i18n'

type LoadState =
  | { status: 'idle' | 'loading'; data: null }
  | { status: 'success'; data: SvgEvaluationPublicResponse }
  | { status: 'error'; data: null }

function formatDuration(durationMs: number | null, locale: 'zh' | 'en') {
  if (durationMs === null) return locale === 'zh' ? '耗时未知' : 'Duration unavailable'
  if (durationMs < 1_000) return `${durationMs} ms`
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`
}

function formatTokens(tokens: number | null) {
  return tokens === null ? '—' : tokens.toLocaleString('en-US')
}

function formatCompletedAt(completedAt: string, locale: 'zh' | 'en') {
  const date = new Date(completedAt)
  if (Number.isNaN(date.getTime())) return completedAt
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function SvgEvaluationGallery({ active }: { active: boolean }) {
  const { t, locale } = useI18n()
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle', data: null })
  const [requestId, setRequestId] = useState(0)
  const [selected, setSelected] = useState<SvgEvaluationPublicItem | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!active) return
    setLoadState({ status: 'loading', data: null })

    fetch(`/api/svg-evaluations?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json() as SvgEvaluationPublicResponse
      })
      .then((data) => {
        if (!Array.isArray(data.items)) throw new Error('Invalid response')
        setLoadState({ status: 'success', data })
      })
      .catch(() => {
        setLoadState({ status: 'error', data: null })
      })
  }, [active, requestId])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])

  const closePreview = useCallback(() => setSelected(null), [])

  return (
    <section className="svg-gallery-section" aria-labelledby="svg-gallery-title">
      <header className="svg-gallery-head">
        <div>
          <span className="section-kicker">{t('effects.kicker')}</span>
          <h2 id="svg-gallery-title">{t('effects.title')}</h2>
          <p>{t('effects.subtitle')}</p>
        </div>
        {loadState.status === 'success' && loadState.data.items.length > 0 ? (
          <div className="svg-gallery-count" aria-label={t('effects.count', { count: loadState.data.items.length })}>
            <strong>{String(loadState.data.items.length).padStart(2, '0')}</strong>
            <span>{t('effects.works')}</span>
          </div>
        ) : null}
      </header>

      {loadState.status === 'loading' || loadState.status === 'idle' ? (
        <div className="svg-gallery-grid" aria-label={t('effects.loading')} aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="svg-card svg-card-skeleton" key={index} aria-hidden="true">
              <div className="svg-card-label"><span /><i /></div>
              <div className="svg-card-canvas" />
              <div className="svg-card-foot"><span /><i /></div>
            </div>
          ))}
          <span className="sr-only">{t('effects.loading')}</span>
        </div>
      ) : null}

      {loadState.status === 'error' ? (
        <div className="svg-gallery-state" role="alert">
          <span className="svg-gallery-state-mark" aria-hidden="true">↻</span>
          <strong>{t('effects.error.title')}</strong>
          <p>{t('effects.error.desc')}</p>
          <button type="button" className="btn btn-ghost" onClick={() => setRequestId((value) => value + 1)}>{t('effects.retry')}</button>
        </div>
      ) : null}

      {loadState.status === 'success' && loadState.data.items.length === 0 ? (
        <div className="svg-gallery-state">
          <span className="svg-gallery-state-mark pelican-mark" aria-hidden="true">⌁</span>
          <strong>{t('effects.empty.title')}</strong>
          <p>{t('effects.empty.desc')}</p>
        </div>
      ) : null}

      {loadState.status === 'success' && loadState.data.items.length > 0 ? (
        <>
          <div className="svg-prompt-strip">
            <span>{t('effects.prompt')}</span>
            <q>{loadState.data.prompt}</q>
            <small>v{loadState.data.promptVersion}</small>
          </div>
          <div className="svg-gallery-grid">
            {loadState.data.items.map((item, index) => (
              <button
                type="button"
                className="svg-card"
                key={item.id}
                onClick={() => setSelected(item)}
                aria-label={t('effects.openPreview', { provider: item.providerName, model: item.modelId })}
                style={{ '--card-order': index } as CSSProperties}
              >
                <span className="svg-card-canvas">
                  <img src={item.imageUrl} alt={t('effects.imageAlt', { provider: item.providerName, model: item.modelId })} loading="lazy" decoding="async" />
                </span>
                <span className="svg-card-info">
                  <span className="svg-card-model"><strong>{item.modelId}</strong><small>{item.providerName || item.providerId}</small></span>
                  <span className="svg-card-metrics">
                    <span><small>{t('effects.outputTokens')}</small><strong>{formatTokens(item.completionTokens)}</strong></span>
                    <span><small>{t('effects.inputTokens')}</small><strong>{formatTokens(item.promptTokens)}</strong></span>
                    <span><small>{t('effects.duration')}</small><strong>{formatDuration(item.durationMs, locale)}</strong></span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <dialog
        ref={dialogRef}
        className="svg-preview-dialog"
        aria-labelledby="svg-preview-title"
        onClose={closePreview}
        onClick={(event) => { if (event.target === event.currentTarget) closePreview() }}
      >
        {selected ? (
          <div className="svg-preview-panel">
            <header>
              <div><span>{selected.providerName || selected.providerId}</span><h2 id="svg-preview-title">{selected.modelId}</h2></div>
              <button type="button" className="svg-preview-close" onClick={closePreview} aria-label={t('effects.close')}>×</button>
            </header>
            <div className="svg-preview-canvas">
              <img src={selected.imageUrl} alt={t('effects.imageAlt', { provider: selected.providerName, model: selected.modelId })} />
            </div>
            <footer>
              <span><small>{t('effects.duration')}</small>{formatDuration(selected.durationMs, locale)}</span>
              <span><small>{t('effects.completed')}</small>{formatCompletedAt(selected.completedAt, locale)}</span>
            </footer>
          </div>
        ) : null}
      </dialog>
    </section>
  )
}
