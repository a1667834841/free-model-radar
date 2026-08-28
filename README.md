# Free Model Radar

运行在 Cloudflare Workers 上的模型可用性与延迟雷达。

## 功能

- Provider 配置放 Cloudflare KV；
- API Key 和管理员 Token 放 Cloudflare Secrets；
- 自动调用 `/v1/models` 发现模型；
- `free-first`：如果模型名包含 `free` / `:free`，优先只测试这些模型；
- 如果 Provider 没有 free 命名模型，则回退完整测试当前发现到的全部模型；
- 通过真实 `/chat/completions` Probe 判断可用性；
- 只要 Probe 成功且返回有效内容，就按 FREE 记录延迟、Token 使用量；
- Cron 每 30 分钟刷新；
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
wrangler secret put REFRESH_ADMIN_TOKEN
wrangler secret put PROVIDER_A_KEY
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

各大模型厂商的免费额度规则各不相同，使用时请参考官方文档：

| 厂商 | 免费规则简介 | 地址 |
|------|-------------|------|
| **DeepSeek** | 注册即赠 500 万 tokens（额度到期时间以官方为准） | [https://platform.deepseek.com/usage](https://platform.deepseek.com/usage) |
| **OpenAI** | 免费用户可使用 GPT-4o mini 等模型，有速率限制 | [https://openai.com/pricing](https://openai.com/pricing) |
| **Anthropic (Claude)** | 免费用户可通过 Claude.ai 聊天界面使用，API 无永久免费额度 | [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing) |
| **Google (Gemini)** | Gemini API 有免费配额（免费层每分钟 60 次请求） | [https://ai.google.dev/pricing](https://ai.google.dev/pricing) |
| **Together AI** | 新用户赠送 $1 额度 | [https://www.together.ai/pricing](https://www.together.ai/pricing) |
| **Groq** | 免费层有速率限制，部分模型免费使用 | [https://groq.com/pricing](https://groq.com/pricing) |
| **Mistral AI** | 开发者免费层有速率限制，部分模型免费 | [https://mistral.ai/products/la-platform](https://mistral.ai/products/la-platform) |
| **360 智脑** | 注册赠送一定额度，具体以官网为准 | [https://ai.360.cn](https://ai.360.cn) |

> 免费规则可能随时变化，请以各厂商官网最新公告为准。

## TODO

- [ ] **趋势图**：增加 1 周内每个模型的吞吐量、首字延迟（TTFT）、端到端延迟的趋势图，便于观察模型性能随时间的变化。

## 注意事项

当前项目使用 OpenNext Cloudflare 适配器：

```bash
npm run build
npm run preview
npm run deploy
```

Cron 的业务入口在 `src/worker.ts`，其 `scheduled()` 会调用同一套 `runRefresh()`。实际部署前需要确认 OpenNext 生成的 Worker 是否已合并 `scheduled()` handler；如果没有，应使用单独 Cron Worker 绑定同一个 KV/Secrets 来运行 `src/worker.ts`。当前尚未执行真实 Cloudflare 部署冒烟测试。