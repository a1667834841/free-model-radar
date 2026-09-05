'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import type { Locale, MessageKey } from '../../i18n'
import { AIHUBMIX_REGISTER_URL, getProviderIconUrl, getProviderRegistrationUrl } from '@/lib/provider-icon'
import type { ProviderResult } from '@/domain/result'

type ProviderGuideModalProps = {
  provider: ProviderResult | null
  onClose: () => void
}

const KEY_PATHS: Record<string, string> = {
  gmicloud: 'Console → API Keys',
  justwoker: 'Account → API Key',
  zenmux: 'Dashboard → API Keys',
  nvidia: 'Build → API Key',
  gorouter: 'Dashboard → API Keys',
  tokenharbor: 'Dashboard → API Keys',
  groq: 'API Keys',
  amd: 'Radeon Cloud → API Keys',
  flatkey: 'Console → API Keys',
}

type LocalizedCopy = Record<Locale, string>

type ProviderGuideContent = {
  registerUrl?: string
  registerDetail: LocalizedCopy
  keyDetail: LocalizedCopy
  highlights: LocalizedCopy[]
  images: Array<{ src: string; caption: LocalizedCopy }>
}

const copy = (zh: string, en: string): LocalizedCopy => ({ zh, en })

const PROVIDER_GUIDES: Record<string, ProviderGuideContent> = {
  openrouter: {
    registerDetail: copy('支持 GitHub / Google 登录，无需绑卡即可开始。', 'Sign in with GitHub or Google; no card is required to start.'),
    keyDetail: copy('进入 Keys 页面创建 API Key，免费模型通常带有 :free 后缀。', 'Open the Keys page and create an API key; free models usually use the :free suffix.'),
    highlights: [
      copy('NVIDIA Nemotron 3 Ultra 等免费模型可直接调用。', 'Free models such as NVIDIA Nemotron 3 Ultra are available.'),
      copy('选择模型时优先查看带 :free 标签的模型。', 'Prefer models marked with the :free tag.'),
    ],
    images: [{ src: '/provider-guides/openrouter.jpg', caption: copy('OpenRouter 免费模型聚合示意', 'OpenRouter free-model aggregation') }],
  },
  bynara: {
    registerDetail: copy('访问 NaraRouter 官网注册账号。', 'Register an account on the NaraRouter website.'),
    keyDetail: copy('免费计划可直接使用，在后台创建 API Key；充值账户可解锁 bonus 模型。', 'Create an API key in the dashboard; funded accounts unlock bonus models.'),
    highlights: [
      copy('免费模型覆盖 Agnes、Qwen、Mistral、DeepSeek、GLM、MiMo 等。', 'Free models include Agnes, Qwen, Mistral, DeepSeek, GLM, and MiMo.'),
      copy('免费计划与已充值账户的可用模型范围不同。', 'Available models differ between the free plan and funded accounts.'),
    ],
    images: [
      { src: '/provider-guides/bynara-1.jpg', caption: copy('NaraRouter 免费模型列表', 'NaraRouter free-model list') },
      { src: '/provider-guides/bynara-2.jpg', caption: copy('NaraRouter 官方宣传图', 'NaraRouter announcement') },
    ],
  },
  sensenova: {
    registerDetail: copy('仅支持 +86 手机号注册。', 'Registration currently requires a +86 phone number.'),
    keyDetail: copy('进入 Token Plan 页面获取 API Key，最多可创建 20 个。', 'Open Token Plan to create API keys; up to 20 keys are supported.'),
    highlights: [
      copy('公测免费 ¥0/月，每个模型 5 小时内最多 1,500 次。', 'Public beta is ¥0/month; up to 1,500 calls per model every 5 hours.'),
      copy('支持 SenseNova、DeepSeek V4 Flash、GLM5.2 等模型。', 'Supports SenseNova, DeepSeek V4 Flash, GLM5.2, and more.'),
    ],
    images: [{ src: '/provider-guides/sensenova.jpg', caption: copy('商汤日日新 Token Plan 公测页面', 'SenseNova Token Plan beta page') }],
  },
  'b-ai': {
    registerDetail: copy('通过邀请链接进入，使用 Google 登录可获得免费积分。', 'Use the invite link and sign in with Google to receive free credits.'),
    keyDetail: copy('新用户积分到账后，在后台创建 API Key。', 'After the new-user credits arrive, create an API key in the dashboard.'),
    highlights: [
      copy('Qwen 3.8 Max、MiniMax M3 等模型有免费体验活动。', 'Qwen 3.8 Max and MiniMax M3 have free-trial availability.'),
      copy('GLM-5.3-Flash 的 API 与 Chat 曾按 0 Credits 结算，活动可能变化。', 'GLM-5.3-Flash has been listed at 0 credits for API and Chat; offers may change.'),
    ],
    images: [
      { src: '/provider-guides/bai-qwen.jpg', caption: copy('B.AI Qwen 免费活动界面', 'B.AI Qwen free offer') },
      { src: '/provider-guides/bai-lineup.jpg', caption: copy('B.AI 免费模型阵容', 'B.AI free-model lineup') },
    ],
  },
  rntm: {
    registerUrl: 'https://runtime.badtheorylabs.com',
    registerDetail: copy('使用邮箱或 Google 登录，完成邮箱验证与 Onboarding。', 'Sign in with email or Google, then verify your email and finish onboarding.'),
    keyDetail: copy('完成 Onboarding 后创建 API Key，可配置 OPENAI_BASE_URL、OPENAI_API_KEY 与 OPENAI_MODEL。', 'After onboarding, create an API key and configure OPENAI_BASE_URL, OPENAI_API_KEY, and OPENAI_MODEL.'),
    highlights: [
      copy('每月提供 10M tokens，btl-2 智能路由自动选择模型。', 'Includes 10M tokens per month with btl-2 smart routing.'),
      copy('文档示例模型为 btl-2；当前监控地址仍以看板中的 API Base URL 为准。', 'The guide uses btl-2 as the example model; use the dashboard endpoint for the monitored route.'),
    ],
    images: [{ src: '/provider-guides/rntm.jpg', caption: copy('BTL Runtime 配置示例', 'BTL Runtime configuration example') }],
  },
  aihubmix: {
    registerUrl: AIHUBMIX_REGISTER_URL,
    registerDetail: copy('通过邀请链接注册，使用前需先充值少量金额以通过防滥用机制。', 'Register with the invite link; a small top-up is required by the anti-abuse policy.'),
    keyDetail: copy('在后台创建 API Key，调用时选择带 free 标签的模型。', 'Create an API key in the dashboard and choose models marked free.'),
    highlights: [
      copy('Coding GLM 5.3、Hy3、MiniMax M3 等模型提供免费档。', 'Coding GLM 5.3, Hy3, and MiniMax M3 have free tiers.'),
      copy('Coding GLM 5.3 的免费档有每分钟、每日和 Token 上限。', 'The Coding GLM 5.3 free tier has per-minute, daily, and token caps.'),
    ],
    images: [{ src: '/provider-guides/aihubmix.jpg', caption: copy('AIHubMix 免费模型列表', 'AIHubMix free-model list') }],
  },
  opencode: {
    registerUrl: 'https://opencode.ai/zen',
    registerDetail: copy('进入 OpenCode Zen，使用 GitHub 登录并完成 Get started。', 'Open OpenCode Zen, sign in with GitHub, and complete Get started.'),
    keyDetail: copy('进入 API Keys 页面创建 Key，Base URL 使用 OpenCode Zen 的 /zen/v1。', 'Open API Keys to create a key; use the OpenCode Zen /zen/v1 base URL.'),
    highlights: [
      copy('Muse Spark 1.2 可免费使用，不需要信用卡。', 'Muse Spark 1.2 is available for free without a credit card.'),
      copy('可接入 Cursor、Cline、Aider 等 AI 编程工具。', 'Works with coding tools such as Cursor, Cline, and Aider.'),
    ],
    images: [
      { src: '/provider-guides/opencode-1.jpg', caption: copy('OpenCode Zen 注册流程', 'OpenCode Zen registration flow') },
      { src: '/provider-guides/opencode-2.jpg', caption: copy('OpenCode Zen API Keys 页面', 'OpenCode Zen API Keys page') },
    ],
  },
  gmicloud: {
    registerDetail: copy('访问 GMI Cloud 控制台注册账号。', 'Register from the GMI Cloud console.'),
    keyDetail: copy('进入后台创建 API Key，接入地址使用 GMI Cloud 的 API Base URL。', 'Create an API key in the dashboard and use the GMI Cloud API base URL.'),
    highlights: [
      copy('MiniMax-M3 曾提供注册后 14 天免费体验。', 'MiniMax-M3 has been offered as a 14-day free trial after registration.'),
      copy('免费活动与模型可用性以控制台当前状态为准。', 'Check the console for current offer and model availability.'),
    ],
    images: [],
  },
  justwoker: {
    registerDetail: copy('必须通过注册链接进入，再使用 GitHub 注册。', 'Enter through the registration link, then sign up with GitHub.'),
    keyDetail: copy('登录后在后台创建 API Key，注册赠送额度以站内实际到账为准。', 'Create an API key in the dashboard; verify the actual welcome credit in the account.'),
    highlights: [
      copy('文档记录的注册链接赠送额度约为 $70–$95，具体以页面为准。', 'The guide reports roughly $70–$95 in welcome credit; verify it on the site.'),
      copy('注册链接不同可能对应不同赠送额度。', 'Different registration links may carry different welcome credits.'),
    ],
    images: [],
  },
  zenmux: {
    registerDetail: copy('通过邀请链接注册账号。', 'Register with the invite link.'),
    keyDetail: copy('登录后台创建 API Key，调用时选择免费模型。', 'Create an API key in the dashboard and choose a free model.'),
    highlights: [
      copy('GLM-5.3 在 ZenMux 上提供免费路径。', 'GLM-5.3 has a free route on ZenMux.'),
      copy('Free 计划与 API 订阅权益可能不同，请以账户页面为准。', 'Free-plan and API entitlements may differ; check the account page.'),
    ],
    images: [{ src: '/provider-guides/zenmux.jpg', caption: copy('ZenMux GLM-5.3 免费路径', 'ZenMux GLM-5.3 free route') }],
  },
  nvidia: {
    registerUrl: 'https://build.nvidia.com',
    registerDetail: copy('注册 NVIDIA 账号，进入模型页面选择可用模型。', 'Create an NVIDIA account and choose a model from the catalog.'),
    keyDetail: copy('选择模型后点击获取 API Key，文档记录的 Key 有效期为 12 个月。', 'Choose a model and get an API key; the guide reports a 12-month validity period.'),
    highlights: [
      copy('Kimi-K3 等模型提供长期或限时免费额度。', 'Models such as Kimi-K3 may have ongoing or limited free quotas.'),
      copy('API 每分钟请求次数有限，免费政策会随时变化。', 'API requests are rate-limited and free policies can change.'),
    ],
    images: [
      { src: '/provider-guides/nvidia-1.jpg', caption: copy('NVIDIA 一年期免费 Key 活动', 'NVIDIA one-year free-key offer') },
      { src: '/provider-guides/nvidia-2.jpg', caption: copy('NVIDIA Kimi-K3 配置说明', 'NVIDIA Kimi-K3 configuration') },
    ],
  },
  gorouter: {
    registerDetail: copy('通过邀请链接使用 GitHub 注册，登录后可获得赠送额度。', 'Use the invite link to sign up with GitHub and receive welcome credit.'),
    keyDetail: copy('进入 API Keys 标签，点击 Create an API key 并复制。', 'Open API Keys, click Create an API key, and copy it.'),
    highlights: [
      copy('文档记录登录赠送约 $80 额度，并支持每日签到。', 'The guide reports about $80 welcome credit and daily check-in rewards.'),
      copy('OpenAI Base URL 使用 gorouter.app/v1。', 'Use gorouter.app/v1 as the OpenAI base URL.'),
    ],
    images: [
      { src: '/provider-guides/gorouter-1.jpg', caption: copy('GoRouter 账户控制台', 'GoRouter account console') },
      { src: '/provider-guides/gorouter-2.jpg', caption: copy('GoRouter 注册教程配图', 'GoRouter registration guide') },
    ],
  },
  tokenharbor: {
    registerDetail: copy('访问 Token Harbor 官网注册账号。', 'Register on the Token Harbor website.'),
    keyDetail: copy('新用户获得免费额度后，在后台创建 API Key。', 'After the welcome allowance is available, create an API key in the dashboard.'),
    highlights: [
      copy('免费额度按滚动 7 天周期、按价值计量。', 'Free usage is value-based over a rolling 7-day window.'),
      copy('文档记录 Kimi K3、DeepSeek V4 Flash、MiMo V2.5 等免费模型。', 'The guide lists Kimi K3, DeepSeek V4 Flash, MiMo V2.5, and others as free.'),
    ],
    images: [{ src: '/provider-guides/tokenharbor.png', caption: copy('Token Harbor 免费模型列表', 'Token Harbor free-model list') }],
  },
  groq: {
    registerDetail: copy('访问 Groq Cloud 控制台注册账号。', 'Register from the Groq Cloud console.'),
    keyDetail: copy('创建 API Key，免费层按每分钟与每日速率限制使用。', 'Create an API key; the free tier is rate-limited per minute and per day.'),
    highlights: [
      copy('可调用 Llama、Mixtral、Gemma、Kimi 等托管开源模型。', 'Use hosted open models such as Llama, Mixtral, Gemma, and Kimi.'),
      copy('免费额度不是固定月度赠送，优先关注 RPM、RPD、TPM、TPD。', 'The free tier is not a fixed monthly grant; watch RPM, RPD, TPM, and TPD.'),
    ],
    images: [
      { src: '/provider-guides/groq-2.jpg', caption: copy('Groq 模型调用参考图', 'Groq model-use reference') },
    ],
  },
  amd: {
    registerUrl: 'https://developer.amd.com.cn/radeon/tokenfactory',
    registerDetail: copy('注册 AMD 开发者账号，进入 Radeon Cloud Token Factory。', 'Create an AMD developer account and open Radeon Cloud Token Factory.'),
    keyDetail: copy('每日自动获得免费额度后创建 API Key。', 'Create an API key after the daily allowance is available.'),
    highlights: [
      copy('文档记录每日约 $10 等值 API 额度，额度每日重置。', 'The guide reports roughly $10/day in API credit, reset daily.'),
      copy('当前免费模型与价格状态请以 AMD 控制台为准。', 'Verify current free-model and pricing status in the AMD console.'),
    ],
    images: [{ src: '/provider-guides/amd.jpg', caption: copy('AMD Radeon Cloud 免费模型 API', 'AMD Radeon Cloud free-model API') }],
  },
  flatkey: {
    registerDetail: copy('通过邀请注册链接注册账号。', 'Register with the invite link.'),
    keyDetail: copy('创建一个 API Key，即可统一接入多个模型并管理账单。', 'Create one API key to access multiple models and manage billing centrally.'),
    highlights: [
      copy('一个 Key 可接入 GPT、Claude、Gemini、DeepSeek 等模型。', 'One key can access GPT, Claude, Gemini, DeepSeek, and more.'),
      copy('DeepSeek V4 Flash 曾有限时免费活动，活动状态以控制台为准。', 'DeepSeek V4 Flash has had limited free offers; check the console for current status.'),
    ],
    images: [
      { src: '/provider-guides/flatkey-1.jpg', caption: copy('Flatkey 限时免费活动', 'Flatkey limited free offer') },
      { src: '/provider-guides/flatkey-2.png', caption: copy('Flatkey 一个 Key 接入多个模型', 'Flatkey one-key multi-model access') },
      { src: '/provider-guides/flatkey-3.jpg', caption: copy('Flatkey 模型与 Key 管理', 'Flatkey model and key management') },
    ],
  },
}

function localized(value: LocalizedCopy, locale: Locale): string {
  return value[locale]
}

function normalizeProviderId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy copy path.
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(textarea)
  return copied
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10.5V4A2 2 0 0 1 5 2h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function RegistrationIllustration({ providerName }: { providerName: string }) {
  const titleId = `guide-visual-${normalizeProviderId(providerName)}`
  return (
    <svg className="guide-visual-svg" viewBox="0 0 520 320" role="img" aria-labelledby={titleId}>
      <title id={titleId}>API key connection flow for {providerName}</title>
      <rect width="520" height="320" rx="16" fill="#0C151E" />
      <rect x="18" y="18" width="484" height="284" rx="11" fill="#111E29" stroke="#2A3E4C" />
      <circle cx="38" cy="39" r="4" fill="#E2625F" />
      <circle cx="52" cy="39" r="4" fill="#E8B44C" />
      <circle cx="66" cy="39" r="4" fill="#3FCF8E" />
      <rect x="34" y="62" width="112" height="218" rx="7" fill="#0E1923" />
      <rect x="49" y="83" width="58" height="7" rx="3.5" fill="#5FB8CE" opacity=".8" />
      <rect x="49" y="111" width="77" height="7" rx="3.5" fill="#2A3E4C" />
      <rect x="49" y="134" width="66" height="7" rx="3.5" fill="#2A3E4C" />
      <rect x="43" y="160" width="89" height="30" rx="6" fill="#F0A35E" opacity=".16" />
      <rect x="55" y="172" width="49" height="7" rx="3.5" fill="#F0A35E" />
      <rect x="49" y="214" width="69" height="7" rx="3.5" fill="#2A3E4C" />
      <rect x="49" y="237" width="52" height="7" rx="3.5" fill="#2A3E4C" />
      <text x="170" y="91" fill="#7E95A4" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1.3">CONSOLE / API KEYS</text>
      <text x="170" y="119" fill="#E8F0F4" fontSize="20" fontWeight="700" fontFamily="system-ui, sans-serif">Create a new key</text>
      <rect x="170" y="140" width="290" height="40" rx="7" fill="#0C151E" stroke="#2A3E4C" />
      <text x="187" y="165" fill="#7E95A4" fontSize="12" fontFamily="ui-monospace, monospace">sk-live-••••••••••••</text>
      <rect x="170" y="198" width="116" height="32" rx="6" fill="#F0A35E" />
      <text x="196" y="219" fill="#0A1118" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">CREATE KEY</text>
      <path d="M305 214h45" stroke="#5FB8CE" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m344 209 7 5-7 5" stroke="#5FB8CE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="364" y="198" width="96" height="32" rx="6" fill="#5FB8CE" opacity=".15" stroke="#5FB8CE" />
      <text x="383" y="219" fill="#5FB8CE" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">CONNECT</text>
      <text x="170" y="261" fill="#6E8896" fontSize="10" fontFamily="ui-monospace, monospace">BASE URL  /v1</text>
    </svg>
  )
}

export default function ProviderGuideModal({ provider, onClose }: ProviderGuideModalProps) {
  const { t, locale } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [imageBroken, setImageBroken] = useState(false)

  const guide = useMemo<ProviderGuideContent | null>(() => {
    if (!provider) return null
    return PROVIDER_GUIDES[normalizeProviderId(provider.id)] ?? {
      registerDetail: copy('访问厂商站点注册账号。', 'Register an account on the provider website.'),
      keyDetail: copy('进入控制台创建 API Key。', 'Open the dashboard to create an API key.'),
      highlights: [copy('免费额度与模型规则以厂商当前页面为准。', 'Check the provider page for current free-quota and model rules.')],
      images: [],
    }
  }, [provider])
  const homeUrl = useMemo(() => getProviderRegistrationUrl(provider ?? undefined, guide?.registerUrl), [guide, provider])
  const iconUrl = useMemo(() => provider ? getProviderIconUrl(provider, homeUrl) : null, [homeUrl, provider])
  const keyPath = provider ? KEY_PATHS[normalizeProviderId(provider.id)] ?? 'Console → API Keys' : ''
  const statusKey = provider ? `status.${provider.status}` as MessageKey : null
  const activeImage = guide?.images[activeImageIndex] ?? null

  useEffect(() => {
    if (!provider) return
    const previousOverflow = document.body.style.overflow
    const previousActiveElement = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus()
    }
  }, [onClose, provider])

  useEffect(() => {
    setCopied(false)
    setActiveImageIndex(0)
    setImageBroken(false)
  }, [provider])

  if (!provider) return null

  const endpoint = provider.baseUrl
  const hasEndpoint = Boolean(endpoint)

  async function handleCopy() {
    if (!endpoint) return
    if (await copyText(endpoint)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="guide-modal-layer">
      <div className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="provider-guide-modal-title" aria-describedby="provider-guide-modal-desc">
        <header className="guide-modal-head">
          <div className="guide-modal-title-wrap">
            <span className="guide-modal-fav">
              {iconUrl ? <img src={iconUrl} alt="" width="26" height="26" /> : <span aria-hidden="true">{(provider.name || provider.id).slice(0, 1).toUpperCase()}</span>}
            </span>
            <div>
              <span className="guide-modal-eyebrow">{t('guide.modalEyebrow')}</span>
              <h2 id="provider-guide-modal-title">{provider.name || provider.id}</h2>
            </div>
          </div>
          <button ref={closeRef} type="button" className="guide-modal-close" onClick={onClose} aria-label={t('guide.close')}>
            <CloseIcon />
          </button>
        </header>

        <div className="guide-modal-body">
          <div className="guide-modal-visual">
            <div className="guide-modal-image-frame">
              {activeImage && !imageBroken ? (
                <img
                  src={activeImage.src}
                  alt={localized(activeImage.caption, locale)}
                  width="1200"
                  height="900"
                  loading="eager"
                  decoding="async"
                  onError={() => setImageBroken(true)}
                />
              ) : (
                <RegistrationIllustration providerName={provider.name || provider.id} />
              )}
            </div>
            <div className="guide-modal-visual-caption">
              <span>{activeImage && !imageBroken ? localized(activeImage.caption, locale) : t('guide.visualCaption')}</span>
              {guide && guide.images.length > 1 ? (
                <div className="guide-image-nav" role="tablist" aria-label={t('guide.imageChoices')}>
                  {guide.images.map((image, index) => (
                    <button
                      type="button"
                      role="tab"
                      key={image.src}
                      aria-selected={activeImageIndex === index}
                      aria-label={t('guide.imageChoice', { n: index + 1 })}
                      onClick={() => { setActiveImageIndex(index); setImageBroken(false) }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="guide-modal-content">
            <div className="guide-modal-intro">
              <p id="provider-guide-modal-desc">{t('guide.modalSub')}</p>
              <span className={`guide-modal-status ${provider.status}`}><i />{statusKey ? t(statusKey) : null}</span>
            </div>

            <div className="guide-modal-address">
              <div>
                <span className="guide-modal-label">{t('guide.registerAddress')}</span>
                {homeUrl ? <a href={homeUrl} target="_blank" rel="noreferrer" title={homeUrl}>{homeUrl}</a> : <span className="guide-modal-muted">{t('guide.linkUnavailable')}</span>}
              </div>
              {homeUrl ? <a className="guide-modal-open" href={homeUrl} target="_blank" rel="noreferrer">{t('guide.openRegister')} <span aria-hidden="true">↗</span></a> : null}
            </div>

            <ol className="guide-modal-steps">
              <li>
                <span className="guide-modal-step-num">01</span>
                <div><strong>{t('guide.modalStep1Title')}</strong><span>{guide ? localized(guide.registerDetail, locale) : t('guide.modalStep1Desc')}</span></div>
              </li>
              <li>
                <span className="guide-modal-step-num">02</span>
                <div><strong>{t('guide.modalStep2Title')}</strong><span>{guide ? `${localized(guide.keyDetail, locale)} · ${keyPath}` : t('guide.modalStep2Desc', { path: keyPath })}</span></div>
              </li>
              <li>
                <span className="guide-modal-step-num">03</span>
                <div><strong>{t('guide.modalStep3Title')}</strong><span>{t('guide.modalStep3Desc')}</span></div>
              </li>
            </ol>

            <div className="guide-highlights">
              <span className="guide-modal-label">{t('guide.keyPoints')}</span>
              <ul>
                {guide?.highlights.map((highlight) => <li key={highlight.zh}>{localized(highlight, locale)}</li>)}
              </ul>
            </div>

            <div className="guide-modal-endpoint">
              <div className="guide-modal-endpoint-label">
                <span>{t('guide.apiEndpoint')}</span>
              </div>
              <div className="guide-modal-endpoint-row">
                {hasEndpoint ? <code title={provider.baseUrl}>{provider.baseUrl}</code> : <span className="guide-modal-muted">{t('guide.endpointUnavailable')}</span>}
                <button type="button" className={`guide-modal-copy${copied ? ' copied' : ''}`} onClick={handleCopy} disabled={!hasEndpoint} aria-live="polite">
                  <CopyIcon />{copied ? t('guide.copied') : t('guide.copyEndpoint')}
                </button>
              </div>
            </div>

            <p className="guide-modal-note"><span aria-hidden="true">i</span>{t('guide.modalNote')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
