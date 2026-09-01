export type AgentConfigContext = {
  providerId: string
  providerName: string
  baseUrl: string
  secretName: string
  /** 主模型（优先写入主槽位 / 默认模型） */
  modelId: string
  /** 该 Provider 下的全部免费模型 id（始终包含 modelId） */
  modelIds: string[]
}

export type AgentOption = {
  id: string
  /** 展示名 */
  label: string
  /** 配置文件路径（相对用户主目录或项目根） */
  configPath: string
  /** 兼容性说明（用于 UI 提示，不写入配置） */
  compatibility: string
  /** 生成配置文本；Cursor 等无标准配置文件的 Agent 生成操作指引 */
  generate: (ctx: AgentConfigContext, option: AgentOption) => string
}

const FALLBACK_SECRET = 'OPENAI_API_KEY'

function apiKeyPlaceholder(secretName: string): string {
  return `<YOUR_${secretName || FALLBACK_SECRET}>`
}

/** 除主模型外的其它免费模型（供多槽位填充 / 备切换） */
function otherModels(ctx: AgentConfigContext): string[] {
  return ctx.modelIds.filter((id) => id !== ctx.modelId)
}

function orderedModels(ctx: AgentConfigContext): string[] {
  return [ctx.modelId, ...otherModels(ctx)]
}

function overflowComment(models: string[], slotLimit: number): string {
  if (models.length <= slotLimit) return ''
  const overflow = models.slice(slotLimit)
  return `\n// 超出 ${slotLimit} 个可配置槽位的模型（请手动切换）：\n//   ${overflow.join('\n//   ')}`
}

export const AGENT_OPTIONS: AgentOption[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    configPath: '~/.claude/settings.json',
    compatibility: '需 Provider 支持 Anthropic Messages API（/v1/messages）',
    generate: (ctx, option) => {
      const models = orderedModels(ctx)
      const [model, alt1, alt2] = models
      const env = [
        `    "ANTHROPIC_BASE_URL": "${ctx.baseUrl}"`,
        `    "ANTHROPIC_AUTH_TOKEN": "${apiKeyPlaceholder(ctx.secretName)}"`,
        `    "ANTHROPIC_MODEL": "${model}"`,
      ]
      if (alt1) env.push(`    "ANTHROPIC_DEFAULT_MODEL": "${alt1}"`)
      // 顶层 model 字段优先级最高，作为第三个槽位（若存在第三个模型）
      const modelField = alt2 ? `,\n  "model": "${alt2}"` : ''
      const overflow = overflowComment(models, 3)
      return `// 配置文件：~/.claude/settings.json（也可写 .claude/settings.local.json）
// ${option.compatibility}
// 将 ${apiKeyPlaceholder(ctx.secretName)} 替换为你的真实 Key。
// 最多可同时配置 3 个免费模型（ANTHROPIC_MODEL / ANTHROPIC_DEFAULT_MODEL / 顶层 model，运行时按优先级取用）。
// ANTHROPIC_BASE_URL 指向非 first-party 域时默认禁用 MCP tool search，
// 可用 ENABLE_TOOL_SEARCH=true 开启。${overflow}
{
  "env": {
${env.join(',\n')}
  }${modelField}
}`
    },
  },
  {
    id: 'codex',
    label: 'OpenAI Codex',
    configPath: '~/.codex/config.toml',
    compatibility: '需 Provider 支持 OpenAI Responses API（wire_api 仅支持 "responses"）',
    generate: (ctx, option) => `# 配置文件：~/.codex/config.toml
# ${option.compatibility}
# 该 Provider 免费模型（可手动切换 model 值）：
#   ${ctx.modelIds.join('\n#   ')}
# env_key 从环境变量读取 Key（例如 export ${ctx.secretName}=sk-xxx）。
model = "${ctx.modelId}"
model_provider = "${ctx.providerId}"

[model_providers.${ctx.providerId}]
name = "${ctx.providerName}"
base_url = "${ctx.baseUrl}"
env_key = "${ctx.secretName}"
wire_api = "responses"`,
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    configPath: '~/.config/opencode/opencode.json',
    compatibility: 'OpenAI Chat Completions（@ai-sdk/openai-compatible），兼容性最好',
    generate: (ctx, option) => {
      const modelsLines = ctx.modelIds.map((id) => `      "${id}": { "name": "${id}" }`)
      return `// 配置文件：~/.config/opencode/opencode.json
// 项目根可用 opencode.json / opencode.jsonc。${option.compatibility}
// apiKey 用 {env:VAR} 引用环境变量。
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "${ctx.providerId}": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "${ctx.providerName}",
      "options": {
        "baseURL": "${ctx.baseUrl}",
        "apiKey": "{env:${ctx.secretName}}"
      },
      "models": {
${modelsLines.join(',\n')}
      }
    }
  },
  "model": "${ctx.providerId}/${ctx.modelId}"
}`
    },
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    configPath: '~/.gemini/settings.json',
    compatibility: '需 Provider 支持 Gemini API（generativelanguage），仅 Gemini 兼容端点可用',
    generate: (ctx, option) => `# 配置文件：~/.gemini/settings.json（或 ~/.zshrc / 项目 .env）
# ${option.compatibility}
# 该 Provider 免费模型（可手动切换 GEMINI_MODEL）：
#   ${ctx.modelIds.join('\n#   ')}
export GEMINI_API_KEY="${apiKeyPlaceholder(ctx.secretName)}"
export GEMINI_MODEL="${ctx.modelId}"
export GEMINI_BASE_URL="${ctx.baseUrl}"`,
  },
  {
    id: 'zed',
    label: 'Zed',
    configPath: '~/.config/zed/settings.json',
    compatibility: '支持自定义 OpenAI-compatible endpoint；API Key 存 Zed Keychain 或本地环境变量',
    generate: (ctx, option) => {
      const models = orderedModels(ctx)
      const [defaultModel, inline, commit, thread, sub] = models
      const availableModels = models.map((model) => `          {
            "name": "${model}",
            "display_name": "${model}",
            "max_tokens": 1000000
          }`)
      const entries = [
        ['default_model', defaultModel],
        ['inline_assistant_model', inline],
        ['commit_message_model', commit],
        ['thread_summary_model', thread],
        ['subagent_model', sub],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]))
      const body = entries.map(([key, model]) => `    "${key}": {
      "provider": "openai",
      "model": "${model}"
    }`)
      return `// 配置文件：~/.config/zed/settings.json
// ${option.compatibility}；自定义 Provider 使用 language_models.openai_compatible。
// 请在 Zed 设置或本地环境中配置 ${ctx.secretName}，不要将 API Key 写入此文件。
// available_models 已包含该 Provider 的全部模型；agent 下的功能槽位预填前 ${entries.length} 个模型。
{
  "language_models": {
    "openai_compatible": {
      "${ctx.providerId}": {
        "api_url": "${ctx.baseUrl}",
        "available_models": [
${availableModels.join(',\n')}
        ]
      }
    }
  },
  "agent": {
    ${body.join(',\n')}
  }
}`
    },
  },
  {
    id: 'cursor',
    label: 'Cursor',
    configPath: '无（GUI 配置）',
    compatibility: '无标准配置文件，仅通过 GUI 设置，自由度有限',
    generate: (ctx, option) => `// Cursor 无标准配置文件，请通过 GUI 设置：
// Settings → Models → API Keys → 填入 Key，勾选「Override OpenAI Base URL」，
// 填写端点与自定义模型名（一个端点仅一份 base URL + key）。
// 端点：${ctx.baseUrl}
// 主模型：${ctx.modelId}
// 该 Provider 全部免费模型：${ctx.modelIds.join('、')}
// API Key 环境变量：${ctx.secretName}`,
  },
]

export function buildAgentConfigContent(option: AgentOption, ctx: AgentConfigContext): string {
  return option.generate(ctx, option)
}

/** 用指定 Provider 与模型构造上下文 */
export function makeAgentConfigContext(input: {
  providerId: string
  providerName: string
  baseUrl?: string
  secretName?: string
  modelId: string
  /** 该 Provider 下的全部免费模型 id（默认仅 modelId） */
  modelIds?: string[]
}): AgentConfigContext {
  const modelId = input.modelId
  const modelIds =
    input.modelIds && input.modelIds.length > 0
      ? input.modelIds.includes(modelId)
        ? input.modelIds
        : [modelId, ...input.modelIds]
      : [modelId]
  return {
    providerId: input.providerId,
    providerName: input.providerName,
    baseUrl: input.baseUrl ?? '<baseUrl>',
    secretName: input.secretName || FALLBACK_SECRET,
    modelId,
    modelIds,
  }
}
