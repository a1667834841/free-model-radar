# Free Model Radar

运行在 Cloudflare Workers 上的模型可用性与延迟雷达。

![Free Model Radar 首页截图](docs/screenshot.png)

## 功能

- Provider 配置放 Cloudflare KV；
- API Key 和管理员 Token 放 Cloudflare Secrets；
- 自动调用 `/v1/models` 发现模型；
- `free-first`：如果模型名包含 `free` / `:free`，优先只测试这些模型；
- 如果 Provider 没有 free 命名模型，则回退完整测试当前发现到的全部模型；
- 通过真实 `/chat/completions` Probe 判断可用性；
- 只要 Probe 成功且返回有效内容，就按 FREE 记录延迟、Token 使用量；
- Cron 每 1消失刷新；
- 管理员通过 `/?admin_token=...` 进入后可手动刷新；
- 连续 5 次失败的模型 ID 自动隐藏。

完整设计见：[`docs/design.md`](docs/design.md)。

## 本地准备

```bash
npm install
cp config/providers.example.json config/providers.local.json
cp .env.example .env.local
```

编辑：

```text
config/providers.local.json
.env.local
```

## Provider 配置

真实配置文件不提交 Git：

```text
config/providers.local.json
```

示例：

```json
{
  "version": 1,
  "updatedAt": "2026-08-27T09:00:00.000Z",
  "providers": [
    {
      "id": "provider-a",
      "name": "Provider A",
      "baseUrl": "https://api.example.com/v1",
      "secretName": "PROVIDER_A_KEY",
      "enabled": true,
      "modelStrategy": "free-first",
      "freeKeywords": ["free", ":free"],
      "probe": {
        "maxModels": 20,
        "concurrency": 3,
        "attempts": 1,
        "timeoutMs": 25000
      }
    }
  ]
}
```

校验配置：

```bash
npm run kv:validate
```

推送配置到 KV：

```bash
npm run kv:push
```

从 KV 拉取配置：

```bash
npm run kv:pull
```

## Cloudflare Secrets

```bash
npx wrangler secret put REFRESH_ADMIN_TOKEN
npx wrangler secret put PROVIDER_A_KEY
```

## KV

`wrangler.jsonc` 中需要替换真实 KV Namespace ID：

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "RADAR_KV",
      "id": "replace-with-kv-namespace-id"
    }
  ]
}
```

## 开发命令

```bash
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
npm run deploy
```

## 管理员入口

访问：

```text
/?admin_token=你的 REFRESH_ADMIN_TOKEN
```

验证成功后会设置 `HttpOnly` Cookie，有效期 12 小时，并重定向到 `/`。

## 厂商免费规则

当前 `config/providers.local.json` 中实际接入的 Provider 及其免费规则如下（本项目通过模型名匹配 `free` / `:free` 关键词来识别免费模型）：

| Provider | 免费规则简介 | 地址 |
|----------|-------------|------|
| **OpenRouter** | 免费层提供 25+ 个免费模型（`/:free` 后缀），速率限制 50 reqs/day，仅免费模型可免费调用 | [https://openrouter.ai/pricing](https://openrouter.ai/pricing) |
| **Bynara (NaraRouter)** | Free 计划含多个免费模型（Agnes 2.5 Flash、GLM 5.3 Flash Free、MiniMax M3 Free 等），7M tokens/天、15 req/min，免费额度每日重置，无需信用卡 | [https://router.bynara.id](https://router.bynara.id) |
| **SenseNova（商汤日日新）** | 提供日日新系列多模态模型，具体免费额度以官方平台文档为准 | [https://www.sensenova.cn](https://www.sensenova.cn) |
| **B.AI** | 多模型聚合平台，部分模型限时免费（如 DeepSeek V4 Flash、Qwen3.8 Flash 等标记 Limited Free 的模型），支持法币/链上充值 | [https://b.ai](https://b.ai) |

| **RNTM (Runtime)** | 按量付费、无订阅，提供免费路由模型（`freeopenrouter`、`glm-5.2`、`minimax-m3` 等 Free route，$0/1M tokens），价格透明 | [https://rntm.sh](https://rntm.sh) |
| **AIHubMix** | 多模型聚合平台，提供 53 个免费模型（`coding-glm-5.3-free`、`gpt-5.5-free`、`qwen3.6-plus-preview-free` 等，含 `free` 后缀命名），速率与免费额度以官方为准 | [https://aihubmix.com](https://aihubmix.com) |
| **OpenCode ZEN** | opencode.ai 统一 API 网关，提供 7 个免费模型（`deepseek-v4-flash-free`、`hy3-free`、`laguna-s-2.1-free` 等），部分模型有速率限制 | [https://opencode.ai](https://opencode.ai) |

> 免费规则可能随时变化，请以各厂商官网最新公告为准。
```

## TODO

- [x] **趋势图**：增加近 7 天窗口内每个模型的吞吐量、首字延迟（TTFT）、端到端延迟趋势图；累计到 2 天数据即可展示走势，便于观察模型性能随时间的变化。
- [x] **Agent 配置导出**：新增「Agent 配置」页，导出各大 Agent 的模型配置信息，仅支持复制（不提供下载）。可复制当前免费模型的 ID，以及对应 Agent（Claude Code、Codex、OpenCode、Gemini CLI、Zed、Cursor）配置文件的格式。配置模板见 [`docs/agent-config-formats.md`](docs/agent-config-formats.md)。

## 趋势数据存储

趋势数据继续使用 Cloudflare KV，不引入 D1。刷新任务完成后会按天追加原始采样：

```text
trend:YYYY-MM-DD
```

每条采样记录包含 `providerId`、`providerName`、`modelId`、`checkedAt`、`status`、`ttftMs`、`tokensPerSec`、`latencyMs`。失败、不可用或缺失记录会保留 `status`，指标值使用 `null`，用于计算成功率并在趋势图中显示断点/失败点。

前端读取近 7 天 bucket 后在服务端聚合平均值、中位数、P95 和成功率；当至少存在 2 个采样日期时展示趋势图。KV 中只保存原始数据，避免派生统计写死。

## 注意事项

当前项目使用 OpenNext Cloudflare 适配器：

```bash
npm run build
npm run preview
npm run deploy
```

Cron 的业务入口在 `src/worker.ts`，其 `scheduled()` 会调用同一套 `runRefresh()`。实际部署前需要确认 OpenNext 生成的 Worker 是否已合并 `scheduled()` handler；如果没有，应使用单独 Cron Worker 绑定同一个 KV/Secrets 来运行 `src/worker.ts`。当前尚未执行真实 Cloudflare 部署冒烟测试。
