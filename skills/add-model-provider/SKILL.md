---
name: add-model-provider
description: 为 free-model-radar 项目添加新的 AI 模型厂商。从测试 API 连通性、分析模型列表与免费识别信号、修改代码（provider-discovery / domain model / provider-icon）、添加配置（providers.local.json / .dev.vars）、更新文档到验证，覆盖完整流程。包含 pricing/pricings/is_free/has_free_route 四种免费信号的处理方式，以及 401/402/403/429 等状态码的排查方法。
---

# 添加 AI 模型厂商（Add Model Provider）

## 何时使用

- 用户提供了一个新厂商的 `baseUrl` 和 API key，要求接入项目
- 用户要求修改现有厂商的跳转地址或图标

## 流程概览

```
测试 API 连通性 → 分析模型列表与免费信号 → 修改代码层（可选）→ 添加配置 → 跳转地址+图标 → 更新文档 → 测试验证 → 告知上线步骤
```

## 1. 测试 API 连通性

### 1.1 测试 /models 端点

```bash
curl -sS --max-time 30 -H 'Authorization: Bearer {token}' -H 'Content-Type: application/json' {baseUrl}/models -w 'HTTP %{http_code} in %{time_total}s\n'
```

**注意事项**：
- `/models` 有可能是**公开接口**（无 token 也返回 200），不能仅凭此证明 token 有效！
- 检验方法：不传 token 或传错误 token 再请求一次，如果也 200 说明 /models 是公开的，需要进一步测 chat/completions。

### 1.2 测试 /chat/completions （真实验证）

用当前最便宜的模型（或用户指定的模型）测试真实调用：

```bash
curl -sS --max-time 30 -H 'Authorization: Bearer {token}' -H 'Content-Type: application/json' \
  -d '{"model":"{model-id}","messages":[{"role":"user","content":"Reply with exactly: pong"}],"max_tokens":64,"stream":true}' \
  {baseUrl}/chat/completions -w '\nHTTP %{http_code}\n'
```

### 1.3 HTTP 状态码排查指南

| 状态码 | 含义 | 处理方式 |
|--------|------|----------|
| 200 ✅ | 调用成功，检查返回内容是否含 `pong` | 可以通过 |
| 401 | token 无效/未认证 | 对照 `X-Oneapi-Request-Id` 等头判断是否 One API 系统，通知用户确认 token |
| 402 | 账户余额不足（防滥用机制） | 免费模型也返回 402 说明 token 没有余额，但权限已通过，可视为「API 可用」 |
| 403 | 权限拒绝（`access_denied`） | token 无效或无权访问该模型，换一个模型尝试。所有模型都 403 说明 token 完全不可用 |
| 429 | 限流（`rate_limit`） | 说明权限已通过，只是暂时访问量大，等一会再试 |

### 1.4 识别底层平台

从响应头判断平台类型：
- `X-Oneapi-Request-Id` → One API 中转站，常见错误 `unauthorized client detected`
- `cf-ray` → Cloudflare 代理
- `x-request-id` / `x-gmi-request-id` → 各自平台自定义

## 2. 分析模型列表

### 2.1 查看原始结构

用 Python 快速分析：

```python
import json
# 打印第一个模型的完整结构
print(json.dumps(data['data'][0], indent=2))
# 列出所有字段 key
keys = set()
for m in data['data']: keys.update(m.keys())
print(sorted(keys))
```

### 2.2 识别免费模型信号

项目支持四种免费信号，每种对应不同的处理方式：

| 信号字段 | 示例厂商 | 需要改代码？ | 处理方式 |
|----------|---------|-------------|---------|
| `pricing`（单数，prompt/completion 为字符串 "0"） | OpenRouter | ✅ 在 `isProviderSpecificFreeModel` 加 case | 用 `isZeroPrice` 检查 prompt/completion |
| `pricings`（复数，数组对象 `[{value: 0}]`） | ZenMux | ✅ 扩展 `parseModelsPayload` + `model.ts` | 解析 `pricings` 字段，提取 prompt/completion 值 |
| `is_free`（布尔值 `true`） | GMI Cloud | ✅ 在 `isProviderSpecificFreeModel` 加 case | 判 `model.isFree === true` |
| `has_free_route`（布尔值） | RNTM | ✅ 在 `isProviderSpecificFreeModel` 加 case | 判 `model.hasFreeRoute === true` |
| 模型 id 含 `free` / `:free` 关键词 | 大部分厂商 | ❌ **不需要** | 由 `freeKeywords` 自动匹配 |
| 以上都没有，且模型数 ≤20 | JustWoker（4 个模型） | ❌ **不需要** | 由项目「回退全测」逻辑自动探测全部模型，成功即标 free |
| 以上都没有，且模型数 >20 | — | ⚠️ 必须加信号 | 否则会被跳过，没有任何模型被探测 |

### 2.3 统计免费模型

```python
free = [m for m in models if m.get('is_free')]
zero = [m for m in models if all(float(m.get('pricing', {}).get(k, 0)) == 0 for k in ('prompt','completion','request','image'))]
# 对于 pricings 结构
def get0(ls):
    if not ls: return None
    vals = [x.get('value') for x in ls if isinstance(x.get('value'), (int,float))]
    return vals[0] if vals else None
free = [m for m in models if get0(m.get('pricings', {}).get('completion')) == 0 and get0(m.get('pricings', {}).get('prompt')) == 0]
```

## 3. 修改代码层（按需）

### 3.1 扩展 /models 解析（`src/services/provider-discovery.ts`）

如果在 `/models` 响应中发现了项目尚未支持的新字段（如 `pricings`），在 `parseModelsPayload` 中添加解析：

```typescript
const pricings = (item as { pricings?: unknown }).pricings
// 添加到 model 对象中
pricings: pricings && typeof pricings === 'object' ? pricings as DiscoveredModel['pricings'] : null,
```

### 3.2 扩展类型定义（`src/domain/model.ts`）

- `DiscoveredModel` 类型增加新字段
- `hasProviderSpecificFreeSignal` 添加新 provider id
- `isProviderSpecificFreeModel` 添加新 case

### 3.3 `isProviderSpecificFreeModel` 各厂商实现参考

| 厂商 | 代码 |
|------|------|
| openrouter | `isZeroPrice(model.pricing?.prompt) && isZeroPrice(model.pricing?.completion)` |
| rntm | `model.hasFreeRoute === true` |
| gmicloud | `model.isFree === true` |
| zenmux | 自定义 `isZenmuxFreeModel(model)` — 检查 `pricings` 中 completion 和 prompt 数组首个值为 0 |

### 3.4 关键陷阱：`hasProviderSpecificFreeSignal`

如果厂商有结构化免费信号（如 `is_free`、`pricings` 零价），**必须在 `hasProviderSpecificFreeSignal` 中也加上该厂商**。否则当没有 free 候选时，项目会回退全测所有模型（>20 个时跳过），导致信号完全失效。

## 4. 添加配置

### 4.1 `config/providers.local.json` 添加条目

```json
{
  "id": "new-provider",
  "name": "New Provider",
  "baseUrl": "https://api.example.com/v1",
  "secretName": "NEW_PROVIDER_API_KEY",
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
```

**注意**：`freeKeywords` 是 schema 必填字段（`min(1)`），即使厂商没有 free 关键词也要给个占位（如 `["free"]`）。实际免费判定由 `isProviderSpecificFreeModel` 控制。

### 4.2 `config/providers.example.json` 同步添加

### 4.3 `.dev.vars` 添加 API key

```bash
NEW_PROVIDER_API_KEY=sk-xxx...
```

### 4.4 `.dev.vars.example` 添加占位

```bash
NEW_PROVIDER_API_KEY=replace-with-your-new-provider-key
```

## 5. 添加跳转地址和图标（`src/lib/provider-icon.ts`）

### 5.1 `PROVIDER_HOME_URLS`

为用户提供跳转链接（可能是推广/邀请链接）：

```typescript
provider-id: 'https://example.com/invite/CODE',
```

### 5.2 `PROVIDER_ICON_DOMAINS`

图标有两种模式：
- 直接 favicon：`'example.com/favicon.ico'` → 返回完整 URL
- Google 服务：`'example.com'` → 用 Google `s2/favicons` 服务

### 5.3 验证方法

```typescript
import { getProviderHomeUrl, getProviderIconUrl } from '@/lib/provider-icon'
const p = { id: 'new-provider', name: 'New Provider', baseUrl: '...' }
console.log('home:', getProviderHomeUrl(p))
console.log('icon:', getProviderIconUrl(p, getProviderHomeUrl(p)))
```

## 6. 更新文档

在 `README.md` 的「厂商免费规则」表格末尾添加新行。格式：

```markdown
| **Provider Name** | 简要说明，模型数量，免费规则 | [链接](https://...) |
```

## 7. 添加测试

在 `tests/model-filter.test.ts` 中添加厂商专用的免费识别测试：

```typescript
it('selects Provider models with {signal}', () => {
  const selected = selectModelsForProbe({ ...provider, id: 'new-provider' }, [
    { id: 'paid', ... },
    { id: 'free', ... },
  ])
  expect(selected.map((m) => m.id)).toEqual(['free'])
})
```

## 8. 验证

按顺序执行：

```bash
npm run kv:validate
npm test
npm run typecheck
```

**端到端验证（可选）**：写临时脚本用真实 API 跑 `discoverModels` + `selectModelsForProbe`，确认筛选结果正确，**验证后删除临时脚本**。

## 9. 告知上线步骤

部署需要 3 步，按依赖顺序：

```bash
npx wrangler secret put NEW_PROVIDER_API_KEY   # 1. 线上 Secret
npm run kv:push                                 # 2. 推送 KV 配置（⚠️ 会覆盖线上配置）
npm run deploy                                  # 3. 构建并部署 Worker
```

**注意事项**：
- `kv:push` 使用本地 `providers.local.json` 覆盖线上 KV，如果本地缺少线上已有的其他厂商配置，会导致其丢失。建议先 `npm run kv:pull` 对比，确认后再 push。
- Secret 不会自动从 `.dev.vars` 同步到线上，必须手动 `wrangler secret put`。
- 部署后 cron（每 30 分钟）会自动执行发现和探测，也可以手动触发。

## 10. 常见陷阱

- **`/models` 公开接口陷阱**：不要仅凭 `/models` 200 就认为 token 有效，必须验证 `/chat/completions`。
- **`kv:push` 覆盖风险**：永远先拉取线上配置对比，再 push。
- **`pricing` vs `pricings`**：不同厂商用不同字段名，必须在 `parseModelsPayload` 中分别解析。
- **`freeKeywords` 不足**：模型名不含 `free` 且没有结构化免费信号时，>20 个模型的厂商会被完全跳过。
- **`hasProviderSpecificFreeSignal` 遗漏**：添加了结构化信号后，必须同时更新此函数，否则信号失效。
- **API key 安全**：永远不要将 API key 回显到输出或输出到 git 提交中。使用 `.dev.vars`（已在 `.gitignore` 中）。