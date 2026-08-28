'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Locale = 'zh' | 'en'

const messages = {
  zh: {
    'brand.tagline': 'free router',
    'page.eyebrow': 'MODEL OBSERVABILITY',
    'page.title': '免费模型路由',
    'page.subtitle': '一眼比较各厂商免费模型的首字耗时与生成吞吐',
    'page.tabs': '页面切换',
    'page.tab.overview': '实时概览',
    'page.tab.trends': '趋势分析',
    'page.tab.agents': 'Agent 配置',
    'agent.title': '导出 Agent 配置',
    'agent.label': '配置导出',
    'agent.exportEntry': '选择 Agent 后自动复制…',
    'agent.sub': '选择 Provider 与免费模型，一键复制到各 Agent 配置文件（仅支持复制）',
    'agent.provider': 'Provider',
    'agent.model': '主模型',
    'agent.modelIds': '免费模型 ID',
    'agent.copy': '复制',
    'agent.copied': '已复制',
    'agent.copyAll': '复制全部 ID',
    'agent.empty': '该 Provider 暂无免费模型',
    'agent.noProvider': '暂无可供导出的 Provider（需有 baseUrl 且含免费模型）',
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
    'overview.sub': '区间条越短越靠左，说明该厂商首字耗时越低',
    'overview.median': '中位',
    'overview.slowest': '最慢',
    'trend.title': '性能趋势',
    'trend.subtitle': '展示近 7 天窗口；累计到至少 2 天数据后开始显示走势，低延迟与高成功率优先。',
    'trend.range': '窗口',
    'trend.empty.title': '还没有趋势数据',
    'trend.empty.desc': '完成一次刷新后会开始写入历史采样；累计到 2 天数据即可看到趋势图。',
    'trend.pending.title': '趋势正在积累',
    'trend.pending.desc': '当前已有 {count} 天采样；累计到 2 天数据后展示趋势图。',
    'trend.metricTabs': '趋势指标',
    'trend.metric.ttft': '首字耗时',
    'trend.metric.ttftShort': 'TTFT',
    'trend.metric.tps': '吞吐',
    'trend.metric.tpsShort': 'TPS',
    'trend.metric.e2e': '端到端耗时',
    'trend.metric.e2eShort': 'E2E',
    'trend.lowerBetter': '越低越好；红点表示该次探测失败或不可用',
    'trend.higherBetter': '越高越好；红点表示该次探测失败或不可用',
    'trend.summary.bestMedian': '7天中位最佳',
    'trend.summary.stability': '最高成功率',
    'trend.summary.models': '历史模型',
    'trend.summary.samples': '{count} 次采样',
    'trend.chart.allModels': '全部模型趋势',
    'trend.chart.allModelsSub': '统一刻度，适合横向比较谁更低、更稳',
    'trend.chart.providerSub': '厂商内自动刻度，适合看同厂商模型波动',
    'trend.scale.global': '全局刻度',
    'trend.scale.local': '局部刻度',
    'trend.table.median': '中位数',
    'trend.table.avg': '平均值',
    'trend.table.success': '成功率',
    'trend.table.current': '最新',
    'trend.provider.title': '厂商趋势',
    'trend.provider.sub': '摘要默认可见，展开后查看该厂商下所有模型曲线',
    'trend.provider.models': '{count} 个模型',
    'table.title': '免费模型排行',
    'table.titleProvider': '按厂商分组',
    'table.col.rank': '排名',
    'table.col.model': '模型',
    'table.col.provider': '厂商',
    'table.col.latency': '延迟',
    'table.col.ttft': '首字耗时',
    'table.col.tps': '吞吐',
    'table.col.e2e': '端到端耗时',
    'table.col.score': '综合分',
    'table.col.status': '状态',
    'table.col.tokens': 'Token',
    'table.ttft.hint': '首字耗时（TTFT）= 从请求发出到流式返回第一个 token 的时间',
    'table.e2e.hint': '端到端耗时 = 从请求发出到全部响应接收完成的时间',
    'legend.freeHelp': '免费 表示模型探测结果明确命中免费模型规则或免费关键词。',
    'legend.availableHelp': '可用 表示模型可正常调用，但未明确识别为免费模型。',
    'status.free': '免费',
    'status.available': '可用',
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
    'detail.expandHint': '点击展开原始采样证据',
    'detail.evidence': '本次采样证据',
    'detail.evidenceNote': '用于核对吞吐、延迟与 Provider 返回 usage 是否一致',
    'detail.prompt': 'Prompt',
    'detail.content': 'Content',
    'detail.rawData': '完整数据（JSON）',
    'detail.checked': '检查于',
    'detail.latency': '端到端耗时',
    'detail.ttft': '首字耗时',
    'detail.promptTokens': 'Prompt Token',
    'detail.completionTokens': 'Completion Token',
    'detail.totalTokens': 'Total Token',
    'detail.calc.ttft': '首字耗时计算',
    'detail.calc.e2e': '端到端耗时计算',
    'detail.calc.tps': '吞吐计算',
    'detail.calc.ttftFormula': 'TTFT = {ttft}',
    'detail.calc.e2eFormula': 'E2E = {latency}',
    'detail.calc.tpsFormula': '{source} {tokens} ÷ 端到端耗时 {duration} = {tps}',
    'detail.calc.tpsUnavailable': '缺少 completion token 与可估算 content，暂无法计算',
    'detail.calc.providerTokens': 'Provider 返回 completion_tokens',
    'detail.calc.estimatedTokens': '按 content 长度估算 token',
    'eval.method.label': '评测方式',
    'eval.method.streaming': '流式性能',
    'eval.method.streaming.desc': '综合首字耗时与每秒 token 数排序',
    'eval.method.latency': '端到端耗时',
    'eval.method.latency.desc': '按非流式请求总耗时排序（兼容旧数据）',
    'eval.note.singleThread': '单线程串行请求下的探测结果，不代表并发吞吐',
    'eval.formula.hint': '综合分 = 吞吐(t/s) ÷ (首字耗时秒 + 0.1)，越高越好',
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
    'page.tabs': 'Page tabs',
    'page.tab.overview': 'Live overview',
    'page.tab.trends': 'Trends',
    'page.tab.agents': 'Agent Config',
    'agent.title': 'Export Agent Config',
    'agent.label': 'Config export',
    'agent.exportEntry': 'Pick an Agent to copy…',
    'agent.sub': 'Pick a provider and free model, then copy config snippets for each Agent (copy only)',
    'agent.provider': 'Provider',
    'agent.model': 'Primary model',
    'agent.modelIds': 'Free model IDs',
    'agent.copy': 'Copy',
    'agent.copied': 'Copied',
    'agent.copyAll': 'Copy all IDs',
    'agent.empty': 'No free models for this provider',
    'agent.noProvider': 'No exportable provider (requires baseUrl and free models)',
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
    'trend.title': 'Performance trends',
    'trend.subtitle': 'Shows a 7-day window; charts appear once at least 2 sampled days exist, with low latency and high success rate first.',
    'trend.range': 'Window',
    'trend.empty.title': 'No trend data yet',
    'trend.empty.desc': 'Trend samples are written after completed refreshes. Charts appear once 2 sampled days exist.',
    'trend.pending.title': 'Collecting trend data',
    'trend.pending.desc': '{count} sampled day so far; charts appear once 2 sampled days exist.',
    'trend.metricTabs': 'Trend metrics',
    'trend.metric.ttft': 'TTFT',
    'trend.metric.ttftShort': 'TTFT',
    'trend.metric.tps': 'Throughput',
    'trend.metric.tpsShort': 'TPS',
    'trend.metric.e2e': 'End-to-end latency',
    'trend.metric.e2eShort': 'E2E',
    'trend.lowerBetter': 'Lower is better; red dots mark failed or unavailable probes',
    'trend.higherBetter': 'Higher is better; red dots mark failed or unavailable probes',
    'trend.summary.bestMedian': 'Best 7d median',
    'trend.summary.stability': 'Best success rate',
    'trend.summary.models': 'Historical models',
    'trend.summary.samples': '{count} samples',
    'trend.chart.allModels': 'All model trends',
    'trend.chart.allModelsSub': 'Global scale for quick cross-model comparison',
    'trend.chart.providerSub': 'Local scale for provider-level fluctuation',
    'trend.scale.global': 'Global scale',
    'trend.scale.local': 'Local scale',
    'trend.table.median': 'Median',
    'trend.table.avg': 'Average',
    'trend.table.success': 'Success',
    'trend.table.current': 'Current',
    'trend.provider.title': 'Provider trends',
    'trend.provider.sub': 'Summaries stay visible; expand to inspect each provider chart',
    'trend.provider.models': '{count} models',
    'table.title': 'Free model ranking',
    'table.titleProvider': 'Models by provider',
    'table.col.rank': 'Rank',
    'table.col.model': 'Model',
    'table.col.provider': 'Provider',
    'table.col.latency': 'Latency',
    'table.col.ttft': 'TTFT',
    'table.col.tps': 'Throughput',
    'table.col.e2e': 'E2E time',
    'table.col.score': 'Score',
    'table.col.status': 'Status',
    'table.col.tokens': 'Token',
    'table.ttft.hint': 'TTFT = time from sending the request to receiving the first streamed token',
    'table.e2e.hint': 'E2E time = time from sending the request to receiving the full response',
    'legend.freeHelp': 'free means the probe clearly matched free-model rules or free keywords.',
    'legend.availableHelp': 'available means the model can be called successfully, but was not explicitly identified as free.',
    'status.free': 'free',
    'status.available': 'available',
    'badge.fastest': 'fastest',
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
    'detail.expandHint': 'Click to expand raw probe evidence',
    'detail.evidence': 'Probe evidence',
    'detail.evidenceNote': 'Use this to verify throughput, latency, and provider usage fields',
    'detail.prompt': 'Prompt',
    'detail.content': 'Content',
    'detail.rawData': 'Full JSON',
    'detail.checked': 'Checked at',
    'detail.latency': 'E2E time',
    'detail.ttft': 'TTFT',
    'detail.promptTokens': 'Prompt tokens',
    'detail.completionTokens': 'Completion tokens',
    'detail.totalTokens': 'Total tokens',
    'detail.calc.ttft': 'TTFT calculation',
    'detail.calc.e2e': 'E2E calculation',
    'detail.calc.tps': 'Throughput calculation',
    'detail.calc.ttftFormula': 'TTFT = {ttft}',
    'detail.calc.e2eFormula': 'E2E = {latency}',
    'detail.calc.tpsFormula': '{source} {tokens} ÷ E2E time {duration} = {tps}',
    'detail.calc.tpsUnavailable': 'Missing completion tokens and estimable content, so throughput is unavailable',
    'detail.calc.providerTokens': 'provider completion_tokens',
    'detail.calc.estimatedTokens': 'estimated tokens from content length',
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
