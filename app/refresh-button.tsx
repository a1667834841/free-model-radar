'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from './i18n'

export default function RefreshButton() {
  const router = useRouter()
  const { t } = useI18n()
  const [state, setState] = useState<'idle' | 'running' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleRefresh() {
    setState('running')
    setMessage(t('refresh.scanningProviders'))

    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { accept: 'application/json' },
      })
      const payload = await response.json() as { error?: string; refreshId?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? `${t('refresh.failed')}（HTTP ${response.status}）`)
      }

      await waitForRefresh(payload.refreshId)
      router.refresh()
      setState('idle')
      setMessage(t('refresh.done'))
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : t('refresh.failed'))
    }
  }

  async function waitForRefresh(refreshId?: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const response = await fetch('/api/refresh/status', { cache: 'no-store' })
      if (!response.ok) {
        continue
      }
      const status = await response.json() as {
        status: string
        refreshId?: string
        error?: string
        progress?: { completed: number; total: number } | null
      }
      if (refreshId && status.refreshId && status.refreshId !== refreshId) continue
      if (status.status === 'success') return
      if (status.status === 'failed') throw new Error(status.error ?? t('refresh.failed'))

      if (status.status === 'running' && status.progress && status.progress.total > 0) {
        setMessage(`${t('refresh.scanning')} ${status.progress.completed}/${status.progress.total}`)
      }
    }
    throw new Error(t('refresh.timeout'))
  }

  return (
    <div className="refresh-control">
      <button className="refresh-button" type="button" onClick={handleRefresh} disabled={state === 'running'}>
        <span className={state === 'running' ? 'spin-icon' : ''}>{state === 'running' ? '◌' : '↻'}</span>
        {state === 'running' ? t('refresh.scanning') : t('refresh.now')}
      </button>
      {message ? <span className={`refresh-message ${state === 'error' ? 'warning' : 'muted'}`}>{message}</span> : null}
    </div>
  )
}
