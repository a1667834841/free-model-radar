# 部署 Free Model Radar

Free Model Radar 需要 Cloudflare Workers、KV、D1 和两个 Queue。你还需要准备至少一个受支持模型厂商的 API Key。

## 配置清单

| 配置 | 是否必需 | 用途 |
|------|----------|------|
| `RADAR_KV` | 是 | 保存 Provider 配置、最新测评结果和刷新状态 |
| `RADAR_DB` | 是 | 保存趋势样本和 SVG 效果测评 |
| `REFRESH_QUEUE` | 是 | 分批执行模型发现与测速 |
| `SVG_EVALUATION_QUEUE` | 是 | 分批执行 SVG 效果测评 |
| `REFRESH_ADMIN_TOKEN` | 是 | 登录管理界面和手动触发刷新 |
| `GATEWAY_API_KEY` | 是 | 调用 OpenAI 兼容网关 |
| 厂商 API Key | 至少一个 | 调用对应模型厂商，例如 `GROQ_API_KEY` |
| `MONITOR_TOKEN` | 可选 | 保护外部健康检查接口 |
| `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID` | 可选 | 发送刷新异常告警 |

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/a1667834841/free-model-radar)

1. 点击按钮，登录 Cloudflare，并授权 GitHub 或 GitLab。
2. 选择账户、仓库名和 Worker 名称，确认创建项目。
3. Cloudflare 根据 `wrangler.jsonc` 创建并绑定 KV、D1 和 Queue，然后构建、发布 Worker。
4. 在新项目的 **Settings → Variables and Secrets** 中设置 `REFRESH_ADMIN_TOKEN`、`GATEWAY_API_KEY` 和准备使用的厂商 API Key。
5. 克隆 Cloudflare 创建的新仓库，按照[配置 Provider](#配置-provider)写入厂商配置。
6. 按照[初始化与验证](#初始化与验证)完成 D1 迁移和第一次刷新。

Cloudflare 可以自动创建项目依赖的资源，但不会替你申请第三方模型厂商的 API Key。自动创建范围与限制以 [Deploy to Cloudflare 官方文档](https://developers.cloudflare.com/workers/platform/deploy-buttons/)为准。

## 手动部署

需要 Node.js、npm、Cloudflare 账户，以及本机可用的 Wrangler 登录会话。

### 1. 安装项目

```bash
git clone https://github.com/a1667834841/free-model-radar.git
cd free-model-radar
npm install
npx wrangler login
```

### 2. 创建 Cloudflare 资源

```bash
npx wrangler kv namespace create RADAR_KV
npx wrangler d1 create free-model-radar
npx wrangler queues create refresh-queue
npx wrangler queues create svg-evaluation-queue
```

将 KV 命令返回的 `id` 和 D1 命令返回的 `database_id` 写入 `wrangler.jsonc`。Queue 名称保持为 `refresh-queue` 和 `svg-evaluation-queue`。

执行数据库迁移：

```bash
npx wrangler d1 migrations apply free-model-radar --remote
```

### 3. 首次发布

```bash
npm run deploy
```

部署完成后，Wrangler 会输出 `*.workers.dev` 地址。

### 4. 设置 Secrets

```bash
npx wrangler secret put REFRESH_ADMIN_TOKEN
npx wrangler secret put GATEWAY_API_KEY
npx wrangler secret put GROQ_API_KEY
```

`GROQ_API_KEY` 只是示例。实际 Secret 名称必须与 Provider 配置中的 `secretName` 完全相同。未使用的厂商不需要设置。

常用厂商对应关系：

| 厂商 | Secret |
|------|--------|
| Groq Cloud | `GROQ_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| GMI Cloud | `GMICLOUD_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| Kira AI | `KIRA_AI_API_KEY` |
| Cavoti | `CAVOTI_API_KEY` |
| Cloudflare Workers AI | `CLOUDFLARE_WORKERS_AI_API_TOKEN` |

如需外部监控和 Telegram 告警，再设置：

```bash
npx wrangler secret put MONITOR_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

## 配置 Provider

复制示例配置：

```bash
cp config/providers.example.json config/providers.local.json
```

编辑 `config/providers.local.json`，只保留准备使用的 Provider，或将其他 Provider 的 `enabled` 设为 `false`。每个 Provider 至少需要：

```json
{
  "id": "groq",
  "name": "Groq Cloud",
  "baseUrl": "https://api.groq.com/openai/v1",
  "secretName": "GROQ_API_KEY",
  "enabled": true,
  "modelStrategy": "free-first",
  "freeKeywords": ["free"],
  "probe": {
    "maxModels": 20,
    "concurrency": 3,
    "attempts": 1,
    "timeoutMs": 25000
  }
}
```

校验并写入远程 KV：

```bash
npm run kv:validate
npm run kv:push
```

真实 API Key 只通过 Cloudflare Secrets 保存，不要写入 Provider 配置或提交到 Git。

## 初始化与验证

如果一键部署流程尚未执行 D1 迁移，先运行：

```bash
npx wrangler d1 migrations apply free-model-radar --remote
```

打开下面的地址建立管理员会话：

```text
https://你的域名/?admin_token=你的-REFRESH_ADMIN_TOKEN
```

在页面中触发刷新，等待 Queue 完成第一次探测，然后检查结果接口：

```bash
curl --fail https://你的域名/api/results
```

验证 OpenAI 兼容网关：

```bash
curl https://你的域名/v1/chat/completions \
  -H "Authorization: Bearer 你的-GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"你的模型 ID","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

也可以将 `model` 设为 `auto`。自动路由只会选择已有健康探测结果且满足能力条件的模型。

## 可选：配置外部监控

仓库中的 `.github/workflows/refresh-monitor.yml` 每 30 分钟检查一次刷新状态。在 GitHub Actions Secrets 中添加：

| Secret | 值 |
|--------|----|
| `RADAR_MONITOR_URL` | `https://你的域名/api/monitor` |
| `RADAR_MONITOR_TOKEN` | 与 Cloudflare 的 `MONITOR_TOKEN` 相同 |

如果同时配置了 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`，刷新异常会发送到对应 Telegram 会话。

## 常见问题

- 页面提示 Provider 配置缺失：确认已执行 `npm run kv:push`，且绑定名称为 `RADAR_KV`。
- 刷新任务没有运行：确认两个 Queue 已创建并与 `wrangler.jsonc` 中的名称一致。
- SVG 或趋势页面报错：确认 D1 迁移已经应用到远程数据库。
- 网关返回 `gateway_not_configured`：确认已设置 `GATEWAY_API_KEY` 并重新部署或刷新 Secret。
- 厂商不可用：确认 `secretName` 与 Cloudflare Secret 名称一致，并检查厂商账户额度。
