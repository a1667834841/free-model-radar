'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Locale = 'zh' | 'en'

const messages = {
  zh: {
    'brand.tagline': 'free router',
    'page.eyebrow': 'MODEL OBSERVABILITY',
    'page.title': '免费模型路由',
    'page.subtitle': '一眼比较各厂商免费模型的首字延迟与生成吞吐',
    'data.fresh': '数据同步正常',
    'data.stale': '数据可能已过期',
    'data.lastRefresh': '上次刷新',
    'node.edge': '边缘节点',
    'refresh.now': '立即刷新',
    'refresh.scanning': '扫描中…',
    'refresh.done': '扫描完成',
    'refresh.failed': '刷新失败',
    'refresh.scanningProviders': '正在扫描 Provider…',
    'refresh.statusUnreadable': '无法读取刷新状态',
    'refresh.timeout': '刷新超时，请稍后查看结果',
    'metric.providers': '已接入 Provider',
    'metric.models': '可用模型',
    'metric.fastest': '最快延迟',
    'metric.fastestTtft': '最快首字',
    'metric.cycle': '刷新周期',
    'metric.last': '上次：{time}',
    'view.latency': '按延迟排序',
    'view.ranking': '综合排行',
    'view.provider': '按厂商分组',
    'overview.title': '厂商概览',
    'overview.sub': '区间条越短越靠左，说明该厂商首字延迟越低',
    'overview.median': '中位',
    'overview.slowest': '最慢',
    'table.title': '可用模型排行',
    'table.titleProvider': '按厂商分组',
    'table.col.rank': '排名',
    'table.col.model': '模型',
    'table.col.provider': '厂商',
    'table.col.latency': '延迟',
    'table.col.ttft': '首字延迟',
    'table.col.tps': '吞吐',
    'table.col.score': '综合分',
    'table.col.status': '状态',
    'table.col.tokens': 'Token',
    'legend.freeHelp': 'FREE 表示模型探测结果明确命中免费模型规则或免费关键词。',
    'legend.availableHelp': 'AVAILABLE 表示模型可正常调用，但未明确识别为免费模型。',
    'badge.fastest': '最快',
    'status.healthy': '运行正常',
    'status.empty': '暂无模型',
    'status.unavailable': '连接异常',
    'provider.models': '{count} 个可用模型',
    'empty.providers.title': '等待 Provider 配置',
    'empty.providers.desc': '将 providers.local.json 推送到 KV 后开始监控',
    'empty.models.title': '暂无可用模型',
    'empty.models.desc': '点击立即刷新，开始第一次模型探测',
    'footer.operational': '系统运行正常',
    'footer.operationalHelp': '表示最近一次完整 Probe 已完成，当前展示的数据可用',
    'footer.node': '当前部署节点',
    'detail.prompt': 'Prompt',
    'detail.content': 'Content',
    'detail.checked': '检查于',
    'detail.latency': '总延迟',
    'eval.method.label': '评测方式',
    'eval.method.streaming': '流式性能',
    'eval.method.streaming.desc': '综合首字延迟与每秒 token 数排序',
    'eval.method.latency': '端到端延迟',
    'eval.method.latency.desc': '按非流式请求总耗时排序（兼容旧数据）',
    'eval.note.singleThread': '单线程串行请求下的探测结果，不代表并发吞吐',
    'eval.formula.hint': '综合分 = 吞吐(t/s) ÷ (首字延迟秒 + 0.1)，越高越好',
    'refresh.status': '刷新：{status}',
    'error.banner': '最近一次刷新失败：{error}',
    'lang.toggle': 'EN',
    'time.justNow': '刚刚',
    'time.minAgo': '{n} 分钟前',
    'time.hourAgo': '{n} 小时前',
  },
  en: {
    'brand.tagline': 'free router',
    'page.eyebrow': 'MODEL OBSERVABILITY',
    'page.title': 'Free Model Router',
    'page.subtitle': 'Compare TTFT and generation throughput of free models across providers at a glance',
    'data.fresh': 'Data is fresh',
    'data.stale': 'Data may be stale',
    'data.lastRefresh': 'Last refresh',
    'node.edge': 'Edge node',
    'refresh.now': 'Refresh now',
    'refresh.scanning': 'Scanning…',
    'refresh.done': 'Scan complete',
    'refresh.failed': 'Refresh failed',
    'refresh.scanningProviders': 'Scanning providers…',
    'refresh.statusUnreadable': 'Cannot read refresh status',
    'refresh.timeout': 'Refresh timed out, check results later',
    'metric.providers': 'Providers',
    'metric.models': 'Available models',
    'metric.fastest': 'Fastest latency',
    'metric.fastestTtft': 'Fastest TTFT',
    'metric.cycle': 'Refresh cycle',
    'metric.last': 'Last: {time}',
    'view.latency': 'By latency',
    'view.ranking': 'Ranking',
    'view.provider': 'By provider',
    'overview.title': 'Provider overview',
    'overview.sub': 'Shorter bar, further left = lower TTFT for that provider',
    'overview.median': 'median',
    'overview.slowest': 'slowest',
    'table.title': 'Model ranking',
    'table.titleProvider': 'Models by provider',
    'table.col.rank': 'Rank',
    'table.col.model': 'Model',
    'table.col.provider': 'Provider',
    'table.col.latency': 'Latency',
    'table.col.ttft': 'TTFT',
    'table.col.tps': 'Throughput',
    'table.col.score': 'Score',
    'table.col.status': 'Status',
    'table.col.tokens': 'Token',
    'legend.freeHelp': 'FREE means the probe clearly matched free-model rules or free keywords.',
    'legend.availableHelp': 'AVAILABLE means the model can be called successfully, but was not explicitly identified as free.',
    'badge.fastest': 'FASTEST',
    'status.healthy': 'Healthy',
    'status.empty': 'No models',
    'status.unavailable': 'Unavailable',
    'provider.models': '{count} available models',
    'empty.providers.title': 'No providers configured',
    'empty.providers.desc': 'Push providers.local.json to KV to start monitoring',
    'empty.models.title': 'No available models yet',
    'empty.models.desc': 'Click refresh now to run the first probe',
    'footer.operational': 'SYSTEM OPERATIONAL',
    'footer.operationalHelp': 'The latest full probe completed successfully and the displayed data is available',
    'footer.node': 'Deployed at',
    'detail.prompt': 'Prompt',
    'detail.content': 'Content',
    'detail.checked': 'Checked at',
    'detail.latency': 'Total latency',
    'eval.method.label': 'Evaluation',
    'eval.method.streaming': 'Streaming',
    'eval.method.streaming.desc': 'Rank by TTFT and tokens per second',
    'eval.method.latency': 'End-to-end',
    'eval.method.latency.desc': 'Sort by total request time (legacy data)',
    'eval.note.singleThread': 'Single-threaded serial probes; not representative of concurrent throughput',
    'eval.formula.hint': 'Score = throughput (t/s) ÷ (TTFT in seconds + 0.1); higher is better',
    'refresh.status': 'Refresh: {status}',
    'error.banner': 'Last refresh failed: {error}',
    'lang.toggle': '中文',
    'time.justNow': 'just now',
    'time.minAgo': '{n} min ago',
    'time.hourAgo': '{n} hr ago',
  },
} as const

export type MessageKey = keyof (typeof messages)['zh']

type LanguageContextValue = {
  locale: Locale
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  setLocale: (locale: Locale) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh'
  const stored = window.localStorage.getItem('fmr-locale')
  if (stored === 'zh' || stored === 'en') return stored
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh')

  useEffect(() => {
    setLocaleState(detectInitialLocale())
  }, [])

  function setLocale(next: Locale) {
    setLocaleState(next)
    try {
      window.localStorage.setItem('fmr-locale', next)
    } catch {
      // localStorage unavailable (private mode etc.) — ignore
    }
  }

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const t = (key: MessageKey, params?: Record<string, string | number>) => {
    let text: string = messages[locale][key]
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value))
      }
    }
    return text
  }

  return (
    <LanguageContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>')
  return ctx
}
