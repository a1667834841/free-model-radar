# Agent 配置文件格式调研

> 目的：为「导出各大 Agent 模型配置信息（仅支持复制）」功能提供依据。
> 调研方式：通过 Monid（tinyfish `/search` + `/fetch`，均为 `$0/call`）抓取各 Agent 官方文档。
> 数据时间：2026-08-28。

---

## 兼容性速览

| Agent | 配置文件（用户级） | 项目级 | API Wire 格式 | 能否直接塞免费模型 |
|-------|--------------------|--------|---------------|--------------------|
| Claude Code | `~/.claude/settings.json` | `.claude/settings.local.json` | Anthropic Messages API | ✅（需网关支持 Anthropic wire） |
| OpenAI Codex | `~/.codex/config.toml` | `.codex/config.toml` | **OpenAI Responses API** | ✅（必须支持 `/responses`） |
| OpenCode | `~/.config/opencode/opencode.json` | `<项目>/opencode.json` | OpenAI Chat Completions（AI SDK openai-compatible） | ✅ 通用 |
| Gemini CLI | `~/.gemini/settings.json` | `.gemini/settings.json` | Gemini API（generativelanguage） | ⚠️ 仅 Gemini 兼容端点 |
| Zed | `~/.config/zed/settings.json` | — | 自定义 OpenAI-compatible provider | ✅ 可配置全部模型；key 存 keychain 或本地环境变量 |
| Cursor | 无标准配置文件 | — | 仅 GUI | ⚠️ 仅 GUI「Override Base URL」，不能写入模型 id |

> 关键差异：**Codex 只支持 Responses wire，Claude Code 只支持 Anthropic wire**。因此导出配置时，必须按各 Agent 的 wire 格式挑选匹配的 Provider，否则无法调用。

---

## 1. Claude Code

- **用户级配置**：`~/.claude/settings.json`（Windows：`%USERPROFILE%\.claude\settings.json`）
- **项目级配置**：`.claude/settings.local.json`（会被加入 gitignore）
- **Wire 格式**：Anthropic Messages API（`/v1/messages`），`Authorization: Bearer` 头由 `ANTHROPIC_AUTH_TOKEN` 控制。
- **关键环境变量**（既可在 shell，也可写进 settings.json 的 `env` 块，settings 中的值会覆盖 shell 中的值）：

| 变量 | 作用 |
|------|------|
| `ANTHROPIC_BASE_URL` | 覆盖 API 端点，用于代理/网关（注意：指向非 first-party 域时默认禁用 MCP tool search，可用 `ENABLE_TOOL_SEARCH=true` 开启） |
| `ANTHROPIC_AUTH_TOKEN` | 自定义 `Authorization` 头的值（会自动加 `Bearer` 前缀），网关常用 |
| `ANTHROPIC_API_KEY` | 作为 `X-Api-Key` 头发送 |
| `ANTHROPIC_MODEL` | 本次会话使用的模型 |
| `ANTHROPIC_DEFAULT_MODEL` | 新会话默认模型（需 v2.1.236+） |

- **模型设置优先级**：`/model`（会话内）→ `--model`（启动）→ `ANTHROPIC_MODEL` → `settings.json` 的 `model` 字段 → `ANTHROPIC_DEFAULT_MODEL`。

### 模板

```jsonc
// ~/.claude/settings.json（JSONC，支持注释）
{
  "env": {
    "ANTHROPIC_BASE_URL": "<baseUrl>",
    "ANTHROPIC_AUTH_TOKEN": "<apiKey>",
    "ANTHROPIC_MODEL": "<modelId>"
  }
}
```

- 也可用设置 `model` 字段：`"model": "<modelId>"`。
- ⚠️ 不要把 API Key 写进项目级 `.claude/settings.json`（会被提交/分享），只写用户级或 `settings.local.json`。

---

## 2. OpenAI Codex

- **用户级配置**：`~/.codex/config.toml`（`$CODEX_HOME` 可改）
- **项目级配置**：`.codex/config.toml`（仅浏览器下列键：`model_provider`、`model_providers`、`notify`、`profile` 等可在项目级，但 provider/通知/遥测键建议放用户级）
- **Wire 格式**：**OpenAI Responses API（`/responses`）**。`wire_api` 只支持 `responses`（默认），`chat/completions` 支持已在弃用中（openai/codex discussion #7782）。
- **关键顶层键**：`model`（默认模型 id）、`model_provider`（选择 `[model_providers.<id>]`）。
- **`[model_providers.<id>]` 常用字段**：

| 字段 | 说明 |
|------|------|
| `name` | 显示名 |
| `base_url` | provider API base URL |
| `env_key` | 提供 API key 的环境变量名 |
| `wire_api` | 协议：`responses`（唯一支持，默认） |
| `env_http_headers` / `http_headers` | 追加请求头 |
| `auth`（表） | 命令式 bearer token 获取 |

### 模板

```toml
# ~/.codex/config.toml
model = "<modelId>"
model_provider = "<providerId>"

[model_providers.<providerId>]
name = "<Provider Name>"
base_url = "<baseUrl>"
env_key = "<SECRET_NAME>"          # 例如 OPENROUTER_API_KEY
wire_api = "responses"
```

- ⚠️ 选中的 Provider 必须实现 OpenAI Responses API（`POST /responses`），仅支持 `/v1/chat/completions` 的网关无法用于 Codex。

---

## 3. OpenCode

- **配置路径**：全局 `~/.config/opencode/opencode.json`；项目根 `opencode.json`；两种均支持 `.jsonc`（JSON with Comments）。
- **Wire 格式**：通过 AI SDK `@ai-sdk/openai-compatible`，走 OpenAI Chat Completions。
- **关键字段**：
  - `provider.<id>.npm`：`@ai-sdk/openai-compatible`（OpenAI 兼容端点）。
  - `provider.<id>.options.baseURL`：端点地址。
  - `provider.<id>.options.apiKey`：API key，用 `{env:VAR}` 引用环境变量（未设置会替换为空串）。
  - `provider.<id>.models`：模型 id → 显示名映射，id 必须与 `GET /v1/models` 返回一致。
  - `model`：全局默认模型，引用格式 `providerId/modelId`。

### 模板

```jsonc
// opencode.json 或 opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "<providerId>": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "<Provider Name>",
      "options": {
        "baseURL": "<baseUrl>",
        "apiKey": "{env:<SECRET_NAME>}"
      },
      "models": {
        "<modelId>": { "name": "<modelId>" }
      }
    }
  },
  "model": "<providerId>/<modelId>"
}
```

- 说明：OpenCode 兼容性最好，支持读取 `GET /v1/models`，多数免费路由网关可直接使用。

---

## 4. Gemini CLI

- **用户级配置**：`~/.gemini/settings.json`；项目级 `.gemini/settings.json`（覆盖用户级）。
- **Wire 格式**：Gemini API（generativelanguage），非 OpenAI/Anthropic。
- **关键环境变量**（也可放 settings / `.env`）：

| 变量 | 作用 |
|------|------|
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | 默认模型 |
| `GEMINI_BASE_URL` | 覆盖 Gemini API 默认 base URL（仅 `gemini-api-key` 认证时生效；必须 HTTPS，除非 localhost） |

### 模板

```bash
# ~/.zshrc 或 ~/.bashrc 或 .gemini/settings.json 的 env
export GEMINI_API_KEY="<apiKey>"
export GEMINI_MODEL="<modelId>"
export GEMINI_BASE_URL="<baseUrl>"
```

- ⚠️ `GEMINI_BASE_URL` 对应的端点必须是 **Gemini API wire**（如 `/v1beta/models/...:generateContent`）。多数 OpenAI 兼容免费网关不符合，因此 Gemini CLI 只能搭配支持 Gemini 的 provider，否则不可用。

---

## 5. Zed

- **配置路径**：`~/.config/zed/settings.json`（macOS 为 `~/Library/Application Support/Zed/settings.json`）。
- **Wire 格式**：支持自定义 OpenAI-compatible provider；API key 存**系统 keychain**或本地环境变量，不写入 settings.json。
- **关键字段**（`agent` 对象下的各模型位）：

| 字段 | 说明 |
|------|------|
| `agent.default_model` | 主模型 `{ provider, model }` |
| `agent.inline_assistant_model` | 内联助手模型 |
| `agent.commit_message_model` | commit message 模型 |
| `agent.thread_summary_model` | 线程摘要模型 |
| `agent.subagent_model` | Agent Panel 的子代理模型 |

### 模板

```json
// ~/.config/zed/settings.json
{
  "language_models": {
    "openai_compatible": {
      "my-provider": {
        "api_url": "https://example.com/v1",
        "available_models": [
          {
            "name": "model-a",
            "display_name": "model-a",
            "max_tokens": 1000000
          },
          {
            "name": "model-b",
            "display_name": "model-b",
            "max_tokens": 1000000
          }
        ]
      }
    }
  },
  "agent": {
    "default_model": {
      "provider": "my-provider",
      "model": "model-a"
    }
  }
}
```

- `language_models.openai_compatible.<provider>.available_models` 可以列出多个模型；`agent` 下的 `default_model`、`inline_assistant_model` 等字段只是不同功能的默认选择，不代表模型总数上限。
- API key 请通过 Zed 设置或对应 provider 生成的环境变量配置，不能写入 settings.json。

---

## 6. Cursor

- **无标准可自由声明的模型配置文件**。
- 只能通过 GUI：`Settings → Models → API Keys → Enter your OpenAI API Key` + 勾选 **Override OpenAI Base URL**，在弹窗里填入自定义端点与自定义模型名。
- 一个 endpoint 只能对应一份 base URL / key（不支持按模型配置独立 base url + key）。

### 结论

Cursor 不适合通过「导出配置文件」嵌入，建议在导出组件中**提示用户走 GUI**，而不是生成配置文件。

---

## 实现建议（供「导出 Agent 配置」功能参考）

1. **选择 Provider**：提供一个下拉（使用 `config/providers.local.json` 里的 `id/name/baseUrl/secretName`），默认选第一个有免费模型的 Provider。
2. **生成各 Agent 片段**：按上面模板，把 `<baseUrl>` 换成该 Provider 的 baseUrl、`<SECRET_NAME>` 换成其 `secretName`、`<modelId>` 换成当前检测到的免费模型 ID（`freeStatus === 'free'`）。
3. **模型 ID 列表**：单独列出该 Provider 当前所有免费模型 ID，支持一键复制。
4. **仅支持复制**：每个 Agent 片段提供「复制」按钮（`navigator.clipboard.writeText`），不做下载。
5. **兼容性提示**：
   - Claude Code 片段附近注明「需要 Provider 支持 Anthropic `/v1/messages`」。
   - Codex 片段附近注明「需要 Provider 支持 OpenAI Responses `/responses`（wire_api 仅 responses）」。
   - Gemini CLI 片段附近注明「需要 Provider 支持 Gemini wire」。
   - Zed / Cursor 片段注明「key 存 keychain / 仅 GUI」，自由度较低。
6. **可扩展性**：后续如加 Aider、Continue、Cline 等，在文档模板区新增即可。
