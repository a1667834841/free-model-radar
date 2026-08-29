---
name: provider-free-tier-research
description: 查询 AI 模型提供商（OpenRouter、Bynara、SenseNova、B.AI、RNTM 等聚合平台）的免费规则与定价信息，用于更新 README 的「厂商免费规则」表格或为新增 Provider 补充资料。先读 config/providers.local.json 确定真实接入的厂商，再用 web_search 搜索定位官方 pricing 页面，用 read_page（firecrawl）抓取确认（裸 fetch 会被 403/401 拦截），最后按统一口径提炼成表格。
---

# 查询 AI 厂商免费规则（Provider Free Tier Research）

## 何时使用

- 更新或修正文档中的「厂商免费规则」表格（如 `README.md`）
- 为新增 Provider 补充免费额度、速率限制、免费模型命名规则等信息
- 核对某个 AI 模型聚合平台（OpenRouter / B.AI / RNTM 等）的定价政策

## 步骤

### 1. 先读本地配置，确定真实接入的厂商清单

- 读取 `config/providers.local.json`（或 `config/providers.example.json`），**只查询其中 `enabled: true` 的厂商**。
- **不要相信 README 现有表格**——它可能已过时或写入了未接入的厂商（本项目曾误写 DeepSeek / OpenAI / Anthropic，实际一个都没接入）。
- 记录每个 provider 的 `id`、`name`、`baseUrl`、`freeKeywords`（如 `free` / `:free`，用于识别该厂商的免费模型命名）。

### 2. 先用 web_search 搜索，定位信息源

- **第一步先调用 `web_search` 工具**，不要直接抓页面。
- 每家厂商一组关键词，例如：
  - `OpenRouter free models pricing`
  - `B.AI 免费模型 定价`
  - `RNTM free route pricing`
  - `{厂商名} free tier / free models / pricing`
- 从搜索结果中挑出**官方 pricing / docs 页面 URL**（域名为厂商官网），以及可信的第三方总结页；记录这些 URL 供下一步抓取。

### 3. 抓取官方信息源（关键：抓取方式）

- 用上一步 `web_search` 定位到的官方 URL，**优先用 `read_page`（firecrawl），不要用裸 `fetch`**：
  - 多个厂商官网（B.AI 等）对裸 `fetch` 返回 403 / 401 / 空文本，且不少官网是 SPA（JS 渲染），裸请求拿不到正文。
  - firecrawl 能绕过简单反爬并渲染 JS。
- 优先抓**官方 pricing / docs 页面**，例如 `https://openrouter.ai/pricing`、各厂商官网的 `/pricing`、`/docs`。
- 官方页面缺失时才参考第三方来源，且必须交叉验证。

### 4. 提炼免费规则，统一口径

每家厂商按以下维度记录（查不到就标注"以官网为准"，不要编造）：

| 维度 | 说明 | 示例 |
|------|------|------|
| 免费模型 | 数量、命名规则 | 25+ 个 `/:free` 后缀模型 |
| 免费额度 | 每日 token / 请求数 | 7M tokens/天、15 req/min |
| 收费模式 | 按量付费 / 订阅 Pass / 充值制、最低价 | Pass 从 $0.99/月起 |
| 限制条件 | 每日重置、限时免费、是否需要信用卡 | 免费额度每日重置 |

### 5. 更新文档

- 表格列：`Provider | 免费规则简介 | 地址`。
- `Provider` 名称、链接与 `providers.local.json` 的 `name` / `baseUrl` 保持一致。
- 表头注明数据来源，例如「当前 `config/providers.local.json` 中实际接入的 Provider」。
- 表格末尾必须加免责说明：

```markdown
> 免费规则可能随时变化，请以各厂商官网最新公告为准。
```

## 陷阱

- 搜索关键词务必带上厂商名 + `free` / `pricing`，只搜厂商名容易命中官网首页而非定价页。
- 裸 `fetch` 域名经常被 403/401 拦截——直接换 `read_page`，不要反复重试裸 fetch。
- 有的厂商有多个域名（如 `rntm.sh` 官网 vs `api.rntm.sh` API 端点），确认抓的是官网页面而不是 API 端点。
- 免费规则变动频繁，查询结果应标注查询日期（记录在 `updatedAt` 或 commit message 中）。
- 不要向文档写入本地配置中不存在的厂商。
