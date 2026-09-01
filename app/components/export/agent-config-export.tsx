'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import {
  AGENT_OPTIONS,
  makeAgentConfigContext,
} from '@/domain/agent-config'
import type { ProviderResult } from '@/domain/result'
import type { FlattenedModel } from '@/domain/evaluation'

type AgentConfigExportProps = {
  providers: ProviderResult[]
  models: FlattenedModel[]
  /** 仅展示指定导出目标：某个 agent id，或 'free-ids' 只展示免费模型 ID */
  exportTarget?: string
  /** 每次用户主动请求复制时递增；避免页面初始化/刷新触发剪贴板写入 */
  copySignal?: number
  /** 精简模式：仅自动复制并显示中央提示，不渲染 Provider/模型选择与配置卡片面板 */
  compact?: boolean
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    throw new Error('clipboard unavailable')
  } catch {
    // 降级：旧浏览器/非安全上下文
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(textarea)
    return ok
  }
}

function CopyIcon() {
  return (
    <svg className="agent-copy-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10.5V4A2 2 0 0 1 5 2h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export default function AgentConfigExport({ providers, models, exportTarget, copySignal = 0, compact }: AgentConfigExportProps) {
  const { t } = useI18n()

  // 只有具备 baseUrl 且存在免费模型的 Provider 才可导出
  const exportableProviders = useMemo(() => {
    return providers
      .filter((provider) => provider.baseUrl)
      .filter((provider) => models.some((m) => m.providerId === provider.id && m.freeStatus === 'free'))
  }, [providers, models])

  const [selectedProviderId, setSelectedProviderId] = useState<string>(exportableProviders[0]?.id ?? '')
  const [primaryModelId, setPrimaryModelId] = useState<string>('')

  const freeModels = useMemo(() => {
    return models.filter((m) => m.providerId === selectedProviderId && m.freeStatus === 'free')
  }, [models, selectedProviderId])

  // 切换 Provider 时，默认选中该 Provider 第一个免费模型
  useEffect(() => {
    const first = freeModels[0]?.id ?? ''
    setPrimaryModelId((current) => (freeModels.some((m) => m.id === current) ? current : first))
  }, [freeModels])

  const selectedProvider = useMemo(
    () => exportableProviders.find((p) => p.id === selectedProviderId) ?? exportableProviders[0],
    [exportableProviders, selectedProviderId],
  )

  const activeModelId = freeModels.some((m) => m.id === primaryModelId) ? primaryModelId : (freeModels[0]?.id ?? '')

  const agentConfigs = useMemo(() => {
    if (!selectedProvider || !activeModelId) return []
    const ctx = makeAgentConfigContext({
      providerId: selectedProvider.id,
      providerName: selectedProvider.name,
      baseUrl: selectedProvider.baseUrl,
      secretName: selectedProvider.secretName,
      modelId: activeModelId,
      modelIds: freeModels.map((model) => model.id),
    })
    return AGENT_OPTIONS.map((option) => ({
      option,
      content: option.generate(ctx, option),
    }))
  }, [selectedProvider, activeModelId, freeModels])

  const visibleConfigs = useMemo(() => {
    if (exportTarget === 'free-ids') return []
    if (exportTarget) {
      return agentConfigs.filter(({ option }) => option.id === exportTarget)
    }
    return agentConfigs
  }, [agentConfigs, exportTarget])

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [toastLeaving, setToastLeaving] = useState(false)
  // 按钮级复制反馈：成功/失败均闪烁 1.4s 后还原，与 json-viewer 一致；toast 仍由 copiedKey 驱动
  const [copyFlash, setCopyFlash] = useState<{ key: string; ok: boolean } | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!copiedKey) return
    setToastLeaving(false)
    // 先播退出动画（1550ms 起），动画播完再卸载（1800ms）
    const leave = setTimeout(() => setToastLeaving(true), 1550)
    const done = setTimeout(() => setCopiedKey(null), 1800)
    return () => {
      clearTimeout(leave)
      clearTimeout(done)
    }
  }, [copiedKey])

  const handleCopy = useCallback(async (text: string, key: string) => {
    const ok = await copyText(text)
    setCopyFlash({ key, ok })
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setCopyFlash(null), 1400)
    if (ok) setCopiedKey(key)
  }, [])

  const copyBtnLabel = useCallback((key: string, idleLabel: string) => {
    if (copyFlash?.key !== key) return idleLabel
    return copyFlash.ok ? t('agent.copied') : t('agent.copyFailed')
  }, [copyFlash, t])

  const copyBtnClass = useCallback((key: string) => {
    return `agent-copy-btn${copyFlash?.key === key && copyFlash.ok ? ' copied' : ''}`
  }, [copyFlash])

  // 只响应用户主动选择，不在页面初始化或刷新时写剪贴板。
  const lastAutoTarget = useRef<string | null>(null)
  useEffect(() => {
    if (!exportTarget || copySignal <= 0) return
    const autoKey = `${copySignal}:${exportTarget}`
    if (lastAutoTarget.current === autoKey) return
    lastAutoTarget.current = autoKey
    if (exportTarget === 'free-ids') {
      const text = freeModels.map((m) => m.id).join('\n')
      if (text) handleCopy(text, 'all-models')
      return
    }
    const target = agentConfigs.find((a) => a.option.id === exportTarget)
    if (target) handleCopy(target.content, exportTarget)
  }, [exportTarget, copySignal, agentConfigs, freeModels, handleCopy])

  if (exportableProviders.length === 0) {
    if (compact) return null
    return (
      <section className="agent-export">
        <div className="section-header">
          <div>
            <span className="section-kicker">{t('agent.title')}</span>
            <span className="section-hint">{t('agent.sub')}</span>
          </div>
        </div>
        <div className="empty-state">
          <span className="empty-icon">⌁</span>
          <strong>{t('agent.noProvider')}</strong>
        </div>
      </section>
    )
  }

  return (
    <section className="agent-export">
      {copiedKey && (
        <div className="agent-copy-toast" role="status" data-leaving={toastLeaving ? 'true' : undefined}>
          <span className="agent-copy-toast-check" aria-hidden="true">✓</span>
          {t('agent.copied')}
        </div>
      )}

      {!compact && (
        <>
          <div className="section-header">
            <div>
              <span className="section-kicker">{t('agent.title')}</span>
              <span className="section-hint">{t('agent.sub')}</span>
            </div>
          </div>
          <div className="agent-export-controls">
        <label className="agent-field">
          <span>{t('agent.provider')}</span>
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
          >
            {exportableProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </label>
        <label className="agent-field">
          <span>{t('agent.model')}</span>
          <select
            value={activeModelId}
            onChange={(e) => setPrimaryModelId(e.target.value)}
          >
            {freeModels.map((model) => (
              <option key={model.id} value={model.id}>{model.id}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="agent-free-models">
        <div className="agent-free-models-head">
          <span>{t('agent.modelIds')}</span>
          <button
            type="button"
            className={copyBtnClass('all-models')}
            onClick={() => handleCopy(freeModels.map((m) => m.id).join('\n'), 'all-models')}
          >
            <CopyIcon />
            {copyBtnLabel('all-models', t('agent.copyAll'))}
          </button>
        </div>
        {freeModels.length === 0 ? (
          <div className="agent-model-empty">{t('agent.empty')}</div>
        ) : (
          <div className="agent-model-chips">
            {freeModels.map((model) => (
              <button
                type="button"
                key={model.id}
                className="agent-model-chip"
                title={model.id}
                onClick={() => handleCopy(model.id, `chip:${model.id}`)}
              >
                {model.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {visibleConfigs.length > 0 && (
        <div className="agent-config-list">
          {visibleConfigs.map(({ option, content }) => (
            <div className="agent-config-card" key={option.id}>
              <div className="agent-config-head">
                <div>
                  <span className="agent-config-name">{option.label}</span>
                  <span className="agent-config-path">{option.configPath}</span>
                </div>
                <button
                  type="button"
                  className={copyBtnClass(option.id)}
                  onClick={() => handleCopy(content, option.id)}
                >
                  <CopyIcon />
                  {copyBtnLabel(option.id, t('agent.copy'))}
                </button>
              </div>
              <div className="agent-compat">{option.compatibility}</div>
              <pre className="agent-config-code"><code>{content}</code></pre>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </section>
  )
}
