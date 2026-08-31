# Free Model Radar

A model availability and latency radar running on Cloudflare Workers.

[简体中文](README.zh-CN.md)

![Free Model Radar home page](docs/screenshot.png)

## Features

- Store provider configuration in Cloudflare KV.
- Store API keys and the administrator token in Cloudflare Secrets.
- Discover models automatically through `/v1/models`.
- Use `free-first`: probe model IDs containing `free` or `:free` first, together with provider-specific free metadata where available.
- When no free candidate exists, small model sets fall back to probing all discovered models; providers with structured free signals or large model sets skip the probe to avoid probing paid models.
- Determine availability through real `/chat/completions` probes.
- Record latency and token usage as FREE when a probe succeeds and returns valid content.
- Refresh every 30 minutes through Cron.
- Let administrators trigger a manual refresh through `/?admin_token=...`.
- Hide model IDs after five consecutive failures.

See [`docs/design.md`](docs/design.md) for the complete design.

## Local setup

```bash
npm install
cp config/providers.example.json config/providers.local.json
cp .env.example .env.local
```

Edit these files:

```text
config/providers.local.json
.env.local
```

## Provider configuration

The real configuration file is not committed to Git:

```text
config/providers.local.json
```

Example:

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

Validate the configuration:

```bash
npm run kv:validate
```

Push the configuration to KV:

```bash
npm run kv:push
```

Pull the configuration from KV:

```bash
npm run kv:pull
```

## Cloudflare Secrets

```bash
npx wrangler secret put REFRESH_ADMIN_TOKEN
npx wrangler secret put PROVIDER_A_KEY
```

## KV

Replace the real KV namespace ID in `wrangler.jsonc`:

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

## Development commands

```bash
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
npm run deploy
```

## Administrator access

Open:

```text
/?admin_token=your-REFRESH_ADMIN_TOKEN
```

After successful verification, the application sets an `HttpOnly` cookie that is valid for 12 hours and redirects to `/`.

## Provider free-tier rules

The following providers and free-tier rules are currently connected in `config/providers.local.json`. Free models are identified through model-ID keywords such as `free` and `:free`, as well as provider-specific metadata where available.

| Provider | Free-tier rule | Link |
|----------|----------------|------|
| **OpenRouter** | The free tier offers 25+ free models with the `:free` suffix. The limit is 50 requests/day, and only free models can be called for free. | [Pricing](https://openrouter.ai/pricing) |
| **Bynara (NaraRouter)** | The Free plan includes several free models, including Agnes 2.5 Flash, GLM 5.3 Flash Free, and MiniMax M3 Free. It includes 7M tokens/day and 15 requests/minute; the quota resets daily and does not require a credit card. | [Router](https://router.bynara.id) |
| **SenseNova** | Provides SenseNova multimodal models. Check the official platform documentation for the current free quota. | [Official site](https://www.sensenova.cn) |
| **B.AI** | A multi-model aggregation platform with some temporarily free models, such as models marked Limited Free. Supports fiat and on-chain top-ups. | [Official site](https://b.ai) |
| **RNTM (Runtime)** | Pay-as-you-go with no subscription. Provides free routes such as `freeopenrouter`, `glm-5.2`, and `minimax-m3` at $0/1M tokens. | [Official site](https://rntm.sh) |
| **AIHubMix** | A multi-model aggregation platform offering 53 free models, including `coding-glm-5.3-free`, `gpt-5.5-free`, and `qwen3.6-plus-preview-free`. Limits and quota are subject to the official policy. | [Official site](https://aihubmix.com) |
| **OpenCode ZEN** | The opencode.ai unified API gateway offers 7 free models, including `deepseek-v4-flash-free`, `hy3-free`, and `laguna-s-2.1-free`; some models have rate limits. | [Official site](https://opencode.ai) |
| **GMI Cloud** | Offers two free models, `MiniMaxAI/MiniMax-M3` and `MiniMaxAI/MiniMax-M2.7`, identified through the `is_free` flag. | [Console](https://console.gmicloud.ai) |
| **JustWoker** | A Claude relay service with four models: `claude-opus-5`, `claude-opus-5-thinking`, `claude-opus-4-8`, and `claude-opus-4-8-thinking`. These IDs have no `free` marker, so availability is detected through the fallback full-probe path. | [Registration](https://api.justwoker.icu/register?aff=BHmu) |
| **ZenMux** | A multi-model aggregation platform with five zero-price models among 166 models, including `z-ai/glm-4.7-flash-free`, `z-ai/glm-4.6v-flash-free`, and `dots-studio/dots3-note-prev`. Some models require a positive account balance. | [Invitation](https://zenmux.ai/invite/DZSANY) |
| **NVIDIA NIM** | Offers 13 Free Endpoint models, including `deepseek-v4-flash-0731`, `kimi-k3`, `nemotron-3-ultra`, and `muse-glimmer`; free endpoints have rate limits. | [Models](https://build.nvidia.com/models) |
| **GoRouter** | An API relay service with four Claude Opus models. These IDs have no `free` marker, so availability is detected through the fallback full-probe path. | [Registration](https://gorouter.app/sign-up?aff=4q8W) |
| **Token Harbor** | An OpenAI-compatible gateway with two free models among 19: `mimo-v2.5:free` and `deepseek-v4-flash:free`. The free quota is limited within a seven-day cycle and resets after the cycle or with a Pass subscription. | [Official site](https://tokenharbor.ai) |
| **Groq Cloud** | Offers 14 models, including `openai/gpt-oss-20b` and `qwen/qwen3.8-27b`. These IDs have no `free` marker, so availability is detected through the fallback full-probe path; the free tier is rate-limited at roughly 14K requests/day. | [Console](https://console.groq.com) |

> Free-tier rules may change at any time. Check each provider's official website for the latest information.

## TODO

- [x] **Trend charts**: Add throughput, time-to-first-token (TTFT), and end-to-end latency trends for each model in a seven-day window. Trends appear after two days of data have accumulated.
- [x] **Agent config export**: Add an Agent Config page that exports model configuration snippets for major Agents. The page supports copying only, not downloading. It can copy the current free model IDs and the format for Claude Code, Codex, OpenCode, Gemini CLI, Zed, and Cursor. See [`docs/agent-config-formats.md`](docs/agent-config-formats.md) for the templates.

## Trend data storage

Trend data continues to use Cloudflare KV; D1 is not introduced. After a refresh completes, raw samples are appended to a daily bucket:

```text
trend:YYYY-MM-DD
```

Each sample contains `providerId`, `providerName`, `modelId`, `checkedAt`, `status`, `ttftMs`, `tokensPerSec`, and `latencyMs`. Failed, unavailable, or missing records retain their `status` and use `null` metric values so the system can calculate success rates and show gaps or failures in trend charts.

The frontend reads the most recent seven daily buckets, then the server aggregates averages, medians, P95, and success rates. Trend charts appear once at least two sampled dates exist. Only raw data is stored in KV; derived statistics are calculated rather than persisted.

## Notes

This project uses the OpenNext Cloudflare adapter:

```bash
npm run build
npm run preview
npm run deploy
```

The Cron business entry point is `src/worker.ts`, whose `scheduled()` handler calls the same `runRefresh()` flow. Before deployment, verify that the Worker generated by OpenNext includes the `scheduled()` handler. If it does not, use a separate Cron Worker bound to the same KV namespace and Secrets to run `src/worker.ts`. A real Cloudflare deployment smoke test has not yet been performed.
