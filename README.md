# Free Model Radar

A model availability and latency radar running on Cloudflare Workers.

[简体中文](README.zh-CN.md)

![Free Model Radar home page](docs/screenshot.png)

## Provider comparison

The following table covers the 15 providers currently connected.

- Catalog counts come from the project `/v1/models` discovery snapshot. Status, available models, and throughput follow the latest deployed [`result` API](https://fm.ggball.top/api/results) snapshot (`2026-09-01T15:32:08.550Z`): a provider with `models.length > 0` is **Normal**; a provider with no model data is **No model data**.
- Throughput is measured by this project with valid `/chat/completions` probes and is shown in `token/s`.
- Provider usage rules are based on current official documentation where available. They may change by account, region, or service policy.

![Live provider status](https://fm.ggball.top/api/provider-status.svg)

| Provider | Status | Available models | Max throughput | Usage mechanism | Link |
|----------|--------|----------------|-----------------|-----------------|------|
| **Groq Cloud** | 🟢 Normal | Result: 8 models — `qwen/qwen3.8-27b`, `openai/gpt-oss-safeguard-20b`, `openai/gpt-oss-20b`, `allam-2-7b`, `openai/gpt-oss-120b`, `groq/compound-mini`, `qwen/qwen3.6-27b`, `groq/compound` | 805.43 token/s | No check-in. The free plan uses RPM, RPD, TPM, and TPD limits rather than a fixed monthly grant. [Rate limits](https://console.groq.com/docs/rate-limits) | [Console](https://console.groq.com) |
| **OpenRouter** | 🟢 Normal | Result: 5 models — `minimax/minimax-m3:free`, `nvidia/nemotron-3-nano-30b-a3b`, `openrouter/free`, `minimax/minimax-m2.5`, `~z-ai/glm-latest` | 206.45 token/s | No check-in. Free models generally allow 50 requests/day; purchasing at least $10 in credits increases the limit to about 1,000/day. [FAQ](https://openrouter.ai/docs/faq) | [Website](https://openrouter.ai) |
| **RNTM** | 🟢 Normal | Result: 12 models — `lfm-2.5-2.6b`, `nemotron-3.5-content-safety`, `free`, `laguna-xs-2.1`, `minimax-m3`, `north-mini-code`, `nemotron-3-ultra-550b-a55b`, `dots-3-note-preview`, `nemotron-3-super-120b-a12b`, `minimax-m2.7`, `nemotron-3-nano-omni-30b-a3b-reasoning`, `nemotron-3.5-lightning` | 85.54 token/s | No check-in; pay-as-you-go. New workspaces may include $5 free credit, while a separate starter offer states that its credit expires after 7 days. [Quickstart](https://rntm.sh/docs/quickstart) · [Starter offer](https://rntm.sh/offer) | [Website](https://rntm.sh) |
| **NVIDIA NIM** | 🟢 Normal | Result: 10 models — `nvidia/nemotron-3.5-content-safety`, `google/diffusiongemma-26b-a4b-it`, `nvidia/riva-translate-4b-instruct-v2`, `nvidia/nemotron-3-ultra-550b-a55b`, `nvidia/ising-calibration-1.5-31b`, `poolside/laguna-xs-2.1`, `minimaxai/minimax-m3`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `moonshotai/kimi-k3` | 70.74 token/s | No check-in. Free Endpoints are rate-limited; no single public daily/monthly quota was found. [Model catalog](https://build.nvidia.com/models) | [Model catalog](https://build.nvidia.com/models) |
| **B.AI** | 🟢 Normal | Result: 7 models — `qwen3.8-27b`, `hy3`, `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`, `minimax-m2.7`, `glm-5.3-flash`, `qwen3.8-flash` | 55.48 token/s | No check-in. The official documentation currently describes some models as free, with usage accounted for by tokens/credits. [Pricing and usage](https://docs.b.ai/zh-Hans/llmservice/pricing-and-usage/) | [Register](https://chat.b.ai/chat?invite_code=ATZT6T) |
| **GMI Cloud** | 🟢 Normal | Result: 2 models — `MiniMaxAI/MiniMax-M3`, `MiniMaxAI/MiniMax-M2.7` | 45.21 token/s | No check-in. Some models are marked free in the catalog, but no fixed public daily/monthly quota was found. [Billing](https://docs.gmicloud.ai/inference-engine/billing/price) | [Console](https://console.gmicloud.ai) |
| **SenseNova** | 🟢 Normal | Result: 3 models — `deepseek-v4-pro`, `deepseek-v4-flash`, `glm-5.2` | 42.60 token/s | No public unified check-in or monthly quota rule found; verify the current account policy on the platform. | [Website](https://www.sensenova.cn) |
| **ZenMux** | 🟢 Normal | Result: 2 models — `z-ai/glm-4.6v-flash-free`, `dots-studio/dots3-note-prev` | 26.74 token/s | No check-in. The Free plan provides about 5 flows/5 hours for Studio Chat only and no API; API access starts with Starter. [Subscription](https://zenmux.ai/docs/guide/subscription.html) | [Register](https://zenmux.ai/invite/DZSANY) |
| **JustWoker** | 🟢 Normal | Result: 4 models — `claude-opus-4-8`, `claude-opus-5`, `claude-opus-4-8-thinking`, `claude-opus-5-thinking` | 5.84 token/s | Public third-party information describes registration credit plus daily check-in credit; exact amounts should be verified on the site. [Third-party reference](https://github.com/panxunying/ai-coding-welfare) | [Register](https://api.justwoker.icu/register?aff=BHmu) |
| **GoRouter** | 🟢 Normal | Result: 4 models — `claude-opus-5-thinking`, `claude-opus-4-8-thinking`, `claude-opus-4-8`, `claude-opus-5` | 5.76 token/s | Third-party information describes a daily check-in, but the amount is unconfirmed. [Third-party reference](https://github.com/panxunying/ai-coding-welfare) | [Register](https://gorouter.app/sign-up?aff=4q8W) |
| **AIHubMix** | 🔴 No model data | Result: 0 models. Catalog: 409 models and 53 free candidates; the latest probe hit an uncharged-account trial limit | — | No check-in. Free models are documented as requiring no card and having no trial expiry, with per-model RPM and daily token caps reset daily. [Free models](https://docs.aihubmix.com/en/blogs/free-ai-models) | [Website](https://aihubmix.com/?aff=FqPM) |
| **AMD Radeon Cloud** | 🔴 No model data | Result: 0 models. Catalog: 4 models and 1 configured candidate, `DeepSeek-V4-Flash` | — | Requires an AMD developer account and API key. The current catalog reports `free: false` with positive prices; verify the account's current access policy before treating the target model as free. | [Radeon Cloud](https://developer.amd.com.cn/radeon) |
| **Bynara** | 🔴 No model data | Result: 0 models. Catalog: 56 models and 6 free candidates, including `glm-5.3-flash-free`, `glm-5.3-free`, and `mimo-v2.5-free` | — | No check-in. The free tier uses per-minute request limits and a daily token quota, normally reset daily in UTC. [Docs](https://router.bynara.id/docs) | [Website](https://router.bynara.id) |
| **OpenCode ZEN** | 🔴 No model data | Result: 0 models. Catalog: 63 models and 7 free candidates; the latest result snapshot contains no available model | — | No check-in. Free models are time-limited; sign-in and billing details are required, while other models are pay-per-request. [ZEN docs](https://dev.opencode.ai/docs/zen/) | [Website](https://opencode.ai) |
| **Token Harbor** | 🔴 No model data | Result: 0 models. Catalog: 19 models and 2 free candidates, `mimo-v2.5:free` and `deepseek-v4-flash:free` | — | No check-in. Free usage is a value-based allowance in a rolling 7-day period; there is no welcome credit and no card is required. [FAQ](https://tokenharbor.ai/faq) | [Website](https://tokenharbor.ai) |

> Throughput values are project Probe measurements, not vendor guarantees. Free models, quotas, and account requirements may change at any time.

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
