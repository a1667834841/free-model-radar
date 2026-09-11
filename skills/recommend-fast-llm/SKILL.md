---
name: recommend-fast-llm
description: 基于 free-model-radar 最新实时测评数据，筛选并推荐前五个适合 Coding 的免费大语言模型。用户询问当前 Coding 模型、编程模型、最快且适合开发的免费模型，或要求读取 radar 数据推荐模型时使用。
---

# 推荐 Coding 模型

## 目标

每次运行都读取最新的 free-model-radar 数据，输出最多 5 个真正适合日常 Coding 的模型。质量优先于数量；合格候选不足 5 个时只输出合格候选，不使用弱模型凑数。

“适合 Coding”同时满足以下条件：模型家族可靠且版本较新、上下文在 128K–1M、是通用大语言模型、实时探测可用、交互速度可接受。

## 数据源

必须优先读取线上接口：

```bash
curl -sS --fail --max-time 30 \
  https://fm.ggball.top/api/results \
  -o /tmp/radar-results.json \
  -w 'HTTP %{http_code}\n'
```

检查：

- HTTP 非 200、JSON 无法解析或没有 `updatedAt` 时停止并说明无法取得最新数据。
- `isStale: true` 时仍可分析，但必须在结果开头标注数据已过期。
- 使用模型自己的 `checkedAt` 判断测评新鲜度，不要只看全局 `updatedAt`。
- 优先使用 `app/model-capabilities.ts` 中按 Provider 和完整模型 ID 匹配的上下文与能力信息；没有能力信息的模型视为上下文未知，不进入 Coding 推荐。

## 硬性筛选

逐条应用，任何一条不满足都排除：

1. Provider 的 `status` 必须为 `healthy`。
2. 如果模型有 `freeStatus` 字段，必须等于 `free`；不能把 `available` 当作免费。
3. `availability` 存在时必须为可用状态。
4. `checkedAt` 距当前时间不超过 36 小时；如果候选不足 5 个，最多放宽到 72 小时，并在该模型后标记“数据较旧”。
5. 必须是通用 LLM：`isLlm === true`，且不是 embedding、image、audio、video、TTS、OCR、rerank 或 moderation 模型。
6. 上下文窗口必须满足 `128000 <= contextWindow <= 1048576`。将 `1.05M` 视为约 1,048,576；“未知”直接排除。
7. 必须有有效的 `ttftMs`、`latencyMs`、`tokensPerSec` 数字。
8. 默认速度门槛：`ttftMs <= 3000`、`latencyMs <= 8000`、`tokensPerSec >= 10`。

以下名称信号直接排除：

```text
embedding translate safety safeguard moderation image video audio tts ocr rerank
vision-exp vision-only flash-lite nano mini-small 1b 3b 7b
```

`mini` 不能单独排除所有模型，但 `gpt-4.1-mini`、`gpt-4.1-nano` 这类轻量模型不能作为 Coding 主推荐，除非没有任何更高质量候选。

## 模型质量白名单

优先选择下列新版本模型家族。模型 ID 必须能明确匹配家族和版本，不能只因为包含 `code` 或 `free` 就放行。

第一优先级：

- OpenAI：`gpt-5+`、`gpt-oss-120b+`
- Anthropic：较新的 `claude-sonnet-*`、`claude-opus-*`
- Google：`gemini-3+`
- DeepSeek：`deepseek-v4+`
- Qwen：`qwen3.6+`
- GLM：`glm-5+`
- Kimi：`kimi-k3+`
- MiniMax：`minimax-m3+`
- NVIDIA Nemotron：`nemotron-3+`，但排除 safety/content-safety/omni 专用变体

第二优先级：

- 较新的 `ling-3+`、`hy3/hy4`、`north-mini-code`
- 其他大型厂商新模型，只有在能力、上下文和实时性能均有数据时才允许进入候选

Provider 只是接入渠道，不等于模型质量。OpenRouter、NVIDIA NIM、Groq、AIHubMix 等渠道上的同一上游模型，按上游模型家族判断质量，再按实际渠道性能排序。

## Coding 排名

先按质量分级，再计算速度和新鲜度。质量分不得被极高 TPS 的弱模型反超。

质量等级建议：

```text
S：Claude Opus/Sonnet、GPT-5+、Gemini 3+、DeepSeek V4、Qwen 3.8+、GLM-5+、Kimi K3、MiniMax M3
A：其他满足白名单和硬性条件的新模型
```

速度等级：

```text
优秀：TTFT <= 1500ms，E2E <= 3000ms，TPS >= 20
可接受：TTFT <= 3000ms，E2E <= 8000ms，TPS >= 10
```

建议排序分数：

```text
speedScore =
  0.50 * clamp(1 - ttftMs / 3000, 0, 1) * 100
  + 0.30 * clamp(1 - latencyMs / 8000, 0, 1) * 100
  + 0.20 * clamp(tokensPerSec / 80, 0, 1) * 100

finalScore =
  qualityScore * 0.50
  + speedScore * 0.35
  + freshnessScore * 0.10
  + stabilityScore * 0.05
```

其中：

- `qualityScore`：S 级 100，A 级 82；轻量模型不能获得 S 级。
- `freshnessScore`：24 小时内 100，36 小时内 85，72 小时内 65。
- `stabilityScore`：如果有历史样本，按最近最多 5 次探测成功率计算；没有历史数据取 70。
- `clamp` 使用 `min(max(value, min), max)`。

排序后进行去重：同一个上游模型通过多个 Provider 提供时，保留分数最高的渠道；同一 Provider 最多保留 2 个模型，尽量覆盖不同上游模型家族。

## 推荐输出

用中文输出最多 5 个，不输出内部评分细节堆砌：

```markdown
推荐这 5 个当前最适合 Coding 的免费模型：

1. **Provider 名称**
   - 模型：`model-id`
   - 上下文：`xxx`
   - 实测：TTFT `xxx ms`，端到端 `xxx ms`，吞吐 `xxx tokens/s`
   - 推荐理由：说明模型质量、版本、速度和适用场景

2. ...
```

如果少于 5 个合格候选，标题改为“当前找到 N 个合格 Coding 模型”，并说明缺少候选的原因。不要把上下文未知、速度超标或质量明显偏弱的模型补进来。

## 选择默认 Coding 模型

如果调用方只需要一个模型，选择排序第一名，但必须满足 S 级或 A 级质量和“可接受”速度。不要选择仅凭模型名称猜测 Coding 能力的模型。

如果第一名是质量强但速度偏慢的 Claude/GPT/Gemini 模型，而第二名是质量可靠且速度明显更好的 DeepSeek/Qwen/GLM/MiniMax 模型，同时两者都合格：

- 默认主模型选择质量更高者；
- 在备选中保留速度更快者；
- 明确说明“质量优先”或“交互速度优先”的取舍。

## 运行脚本要求

可以使用 Python、Node.js 或 shell 处理 JSON，但必须实际执行筛选，不要凭记忆推荐。脚本至少要打印：

- 数据更新时间和 `isStale`
- 通过硬性筛选的候选数
- 最终前五的 Provider、模型 ID、上下文、TTFT、E2E、TPS
- 被排除的主要原因计数

不要输出 `content`、`prompt` 或任何 API Key、Authorization header。
