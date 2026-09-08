---
name: recommend-fast-llm
description: 基于 free-model-radar results API 推荐 3 个速度快且前沿的大语言模型，输出厂商和模型 id。用于用户询问“当前免费模型推荐”“推荐三个快且前沿的大模型”“查 free-model-radar API 并推荐模型”等任务。
---

# 推荐快速前沿大模型（Recommend Fast LLM）

## 何时使用

- 用户要求基于 free-model-radar 的实时结果推荐模型。
- 用户询问当前哪个免费大语言模型速度快、延迟低、吞吐高、模型较新。
- 用户要求输出“厂商 + 模型 id”的 Top 3 推荐。

## 数据源

优先调用线上 results API：

```bash
curl -sS --max-time 30 https://free-model-radar.1667834841.workers.dev/api/results -o /tmp/radar-results.json -w 'HTTP %{http_code}\n'
```

关键结构：

```json
{
  "updatedAt": "2026-09-08T13:34:39.717Z",
  "isStale": false,
  "providers": [
    {
      "id": "openrouter",
      "name": "OpenRouter",
      "status": "healthy",
      "models": [
        {
          "id": "nvidia/nemotron-3-nano-30b-a3b",
          "ttftMs": 1199,
          "tokensPerSec": 206.45,
          "latencyMs": 1240,
          "freeStatus": "free",
          "checkedAt": "2026-08-29T16:23:12.543Z"
        }
      ]
    }
  ]
}
```

## 筛选规则

先过滤真实可用的 chat 模型：

- `freeStatus === 'free'`
- `availability` 可用（如存在且不是失败态）
- `provider.status === 'healthy'`
- `ttftMs` 和 `tokensPerSec` 必须是有效数字
- 排除 `checkedAt` 超过 7 天的数据；如果剩余太少，可放宽到 30 天并在输出里注明“数据较旧”
- 排除明显非 chat 的专用模型：`embedding`、`translate`、`safety`、`image`、`video`、`tts`、`audio`、`ocr` 等

速度评分建议：

- 主排序：综合体验优先看 `ttftMs` 越低越好
- 同档延迟再看 `tokensPerSec` 越高越好
- 可给简单分数：`score = tokensPerSec - max(0, ttftMs - 800) * 0.02`
  - 目标是让“首字快且吞吐高”的模型胜出
  - 若用户更关注连续生成速度，则改为直接按 `tokensPerSec` 降序

前沿性规则：

优先选择新模型家族或高版本模型，例如：

- `gpt-5`, `gpt-6`
- `claude-opus-4-7`, `claude-opus-5`, `claude-sonnet-5`, `claude-fable`
- `gemini-3`, `gemini-4`
- `qwen3.5`, `qwen3.6`, `qwen3.7`, `qwen3.8`
- `glm-5`, `glm-5.2`, `glm-5.3`
- `deepseek-v4`
- `kimi-k3`
- `minimax-m3`
- `nemotron-3`, `nemotron-3.5`, `nemotron-4`
- `ling-3`, `hy3`, `mimo-v2.5`

降低优先级：

- 明显旧代模型：`gpt-4`, `llama-3.1`, `mistral` 早期版本、`deepseek-v3`、旧 `glm-4.x`
- 小工具模型：翻译、安全、embedding，除非用户明确要
- 只快但不“大语言模型前沿”的 nano/mini 模型，除非没有任何强模型满足速度要求

最终选择：

- 如果 Top 速度模型全是旧模型，优先取“足够快且前沿”的模型，而不是单纯最快。
- 输出 3 个；如某个厂商已有模型入选，第三个尽量换厂商，保证推荐面更广。

## 推荐执行脚本

用 Python 一次完成筛选与排序：

```python
import json
from datetime import datetime, timezone

data = json.load(open('/tmp/radar-results.json'))
now = datetime.now(timezone.utc)

def parse_dt(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def is_non_chat(model_id: str) -> bool:
    banned = ('embedding', 'translate', 'safety', 'image', 'video', 'tts', 'audio', 'ocr', 'vision-exp')
    lowered = model_id.lower()
    return any(token in lowered for token in banned)

def modern_score(model_id: str) -> int:
    lowered = model_id.lower()
    patterns = [
        'gpt-5', 'gpt-6', 'claude-opus-4-7', 'claude-opus-5', 'claude-sonnet-5', 'claude-fable',
        'gemini-3', 'gemini-4', 'qwen3.5', 'qwen3.6', 'qwen3.7', 'qwen3.8',
        'glm-5', 'deepseek-v4', 'kimi-k3', 'minimax-m3', 'nemotron-3', 'ling-3', 'hy3', 'mimo-v2.5',
    ]
    old_patterns = ['gpt-4', 'llama-3.1', 'deepseek-v3', 'glm-4.']
    if any(p in lowered for p in old_patterns) and not any(p in lowered for p in patterns):
        return 1
    return 3 if any(p in lowered for p in patterns) else 2

candidates = []
for provider in data.get('providers', []):
    if provider.get('status') != 'healthy':
        continue
    for model in provider.get('models', []):
        if model.get('freeStatus') != 'free':
            continue
        if is_non_chat(model.get('id', '')):
            continue
        ttft = model.get('ttftMs')
        tps = model.get('tokensPerSec')
        if not isinstance(ttft, (int, float)) or not isinstance(tps, (int, float)):
            continue
        checked_at = parse_dt(model.get('checkedAt'))
        age_days = (now - checked_at).total_seconds() / 86400 if checked_at else None
        if age_days is None or age_days > 30:
            continue
        score = float(tps) - max(0, float(ttft) - 800) * 0.02 + modern_score(model.get('id', '')) * 30
        candidates.append({
            'provider_name': provider.get('name') or provider.get('id'),
            'model_id': model.get('id'),
            'ttftMs': ttft,
            'tokensPerSec': tps,
            'latencyMs': model.get('latencyMs'),
            'age_days': age_days,
            'modern_score': modern_score(model.get('id', '')),
            'score': score,
        })

candidates.sort(key=lambda x: x['score'], reverse=True)
picks = []
used_providers = set()
for item in candidates:
    if item['provider_name'] in used_providers and len(picks) < 3:
        continue
    picks.append(item)
    used_providers.add(item['provider_name'])
    if len(picks) == 3:
        break

for item in picks:
    print(f"{item['provider_name']} -> {item['model_id']} | TTFT {item['ttftMs']}ms | {item['tokensPerSec']} t/s | modern {item['modern_score']}/3")
```

如果去重后不足 3 个，再从 `candidates` 里补齐同厂商或其他厂商。

## 输出格式

用中文简洁输出：

```markdown
推荐这 3 个当前免费可用、速度快且较前沿的大语言模型：

1. **厂商名**
   - 模型 id：`model-id`
   - 实测：TTFT `xxx ms`，吞吐 `xxx tokens/s`
   - 推荐理由：…

2. **厂商名**
   - 模型 id：`model-id`
   - 实测：TTFT `xxx ms`，吞吐 `xxx tokens/s`
   - 推荐理由：…

3. **厂商名**
   - 模型 id：`model-id`
   - 实测：TTFT `xxx ms`，吞吐 `xxx tokens/s`
   - 推荐理由：…
```

## 注意事项

- 不要把 `content`、`prompt` 里的采样文本原样粘进推荐，除非用于说明证据。
- `isStale: true` 时提醒用户“radar 数据较旧，推荐基于上一次刷新”。
- `tokensPerSec` 很高但 `completionTokens` 很短的样本要谨慎，尤其 nano/mini 模型；如果综合分高，可标为“轻量模型”而不是前沿主力模型。
- 用户如果明确要求“最快”，则按速度优先；用户要求“快且前沿”，才启用前沿性加权。
