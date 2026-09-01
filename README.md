# Free Model Radar

A model availability and latency radar running on Cloudflare Workers.

[简体中文](README.zh-CN.md)

![Free Model Radar home page](docs/screenshot.png)

## Provider comparison


![Live provider status](https://fm.ggball.top/api/provider-status.svg)

| Provider | Usage mechanism | Link |
|----------|-----------------|------|
| **Groq Cloud** | No check-in. The free plan uses RPM, RPD, TPM, and TPD limits rather than a fixed monthly grant. [Rate limits](https://console.groq.com/docs/rate-limits) | [Console](https://console.groq.com) |
| **OpenRouter** | No check-in. Free models generally allow 50 requests/day; purchasing at least $10 in credits increases the limit to about 1,000/day. [FAQ](https://openrouter.ai/docs/faq) | [Website](https://openrouter.ai) |
| **RNTM** | No check-in; pay-as-you-go. New workspaces may include $5 free credit, while a separate starter offer states that its credit expires after 7 days. [Quickstart](https://rntm.sh/docs/quickstart) · [Starter offer](https://rntm.sh/offer) | [Website](https://rntm.sh) |
| **NVIDIA NIM** | No check-in. Free Endpoints are rate-limited; no single public daily/monthly quota was found. [Model catalog](https://build.nvidia.com/models) | [Model catalog](https://build.nvidia.com/models) |
| **B.AI** | No check-in. The official documentation currently describes some models as free, with usage accounted for by tokens/credits. [Pricing and usage](https://docs.b.ai/zh-Hans/llmservice/pricing-and-usage/) | [Register](https://chat.b.ai/chat?invite_code=ATZT6T) |
| **GMI Cloud** | No check-in. Some models are marked free in the catalog, but no fixed public daily/monthly quota was found. [Billing](https://docs.gmicloud.ai/inference-engine/billing/price) | [Console](https://console.gmicloud.ai) |
| **SenseNova** | No public unified check-in or monthly quota rule found; verify the current account policy on the platform. | [Website](https://www.sensenova.cn) |
| **ZenMux** | No check-in. The Free plan provides about 5 flows/5 hours for Studio Chat only and no API; API access starts with Starter. [Subscription](https://zenmux.ai/docs/guide/subscription.html) | [Register](https://zenmux.ai/invite/DZSANY) |
| **JustWoker** | Public third-party information describes registration credit plus daily check-in credit; exact amounts should be verified on the site. [Third-party reference](https://github.com/panxunying/ai-coding-welfare) | [Register](https://api.justwoker.icu/register?aff=BHmu) |
| **GoRouter** | Third-party information describes a daily check-in, but the amount is unconfirmed. [Third-party reference](https://github.com/panxunying/ai-coding-welfare) | [Register](https://gorouter.app/sign-up?aff=4q8W) |
| **AIHubMix** | No check-in. Free models are documented as requiring no card and having no trial expiry, with per-model RPM and daily token caps reset daily. [Free models](https://docs.aihubmix.com/en/blogs/free-ai-models) | [Website](https://aihubmix.com/?aff=FqPM) |
| **AMD Radeon Cloud** | Requires an AMD developer account and API key. The current catalog reports `free: false` with positive prices; verify the account's current access policy before treating the target model as free. | [Radeon Cloud](https://developer.amd.com.cn/radeon) |
| **Bynara** | No check-in. The free tier uses per-minute request limits and a daily token quota, normally reset daily in UTC. [Docs](https://router.bynara.id/docs) | [Website](https://router.bynara.id) |
| **OpenCode ZEN** | No check-in. Free models are time-limited; sign-in and billing details are required, while other models are pay-per-request. [ZEN docs](https://dev.opencode.ai/docs/zen/) | [Website](https://opencode.ai) |
| **Token Harbor** | No check-in. Free usage is a value-based allowance in a rolling 7-day period; there is no welcome credit and no card is required. [FAQ](https://tokenharbor.ai/faq) | [Website](https://tokenharbor.ai) |

> Free models, quotas, and account requirements may change at any time.

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
