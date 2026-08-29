#!/usr/bin/env bash
# 批量探测：对每个厂商的【全部模型】各发一次请求，用响应结果判定 free。
#   free        = 能成功拿到有效响应（200 + 非空 content + 不含“额度用尽”文本）
#   limited     = 429 / 5xx / 超时 / 200但content空 → 退避后重试，直到判定
#   unavailable = 401/403/404/400 等 → 判定非免费，不再重试
# 时间压缩：首轮全模型并发；只有 limited 进下一轮重试；free/unavailable 不再占配额。
# 输出 results.json 结构对齐 src/domain/result.ts 的 ResultsSnapshot（models 仅含 free 模型）。
#
# 用法:
#   bash scripts/probe-batch.sh [config文件]
#
# 可调环境变量:
#   PROBE_CONCURRENCY=25    每厂商并发上限（默认 25；厂商之间另并行跑）
#   MAX_ROUNDS=6            每厂商最多重试轮数（默认 6）
#   BACKOFF_SECONDS=20      每轮重试前的退避秒数（默认 20，给限流窗口恢复）
#   DEADLINE_SECONDS=300    每厂商总时间预算，超时后剩余 limited 直接记 limited（默认 300）
#   PROBE_TIMEOUT_MS=10000  覆盖单次探测超时（默认读配置 25000）
#   SERIAL=1                provider 之间串行（一个一个厂商跑）
#   ONLY=openrouter         只跑指定厂商
#   MAX_MODELS_OVERRIDE=3   【试跑用】每厂商只测前 N 个模型，正式跑不要设
set -uo pipefail
cd "$(dirname "$0")/.."

CONFIG="${1:-config/providers.local.json}"
ENV_FILE=".dev.vars"
OUT_DIR=".probe-out"

PROBE_CONCURRENCY="${PROBE_CONCURRENCY:-25}"
MAX_ROUNDS="${MAX_ROUNDS:-6}"
BACKOFF_SECONDS="${BACKOFF_SECONDS:-20}"
DEADLINE_SECONDS="${DEADLINE_SECONDS:-300}"

# 尽量抬高文件描述符上限，支撑高并发 curl
ulimit -n 4096 2>/dev/null || true

set -a
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
set +a

command -v jq >/dev/null || { echo "需要 jq" >&2; exit 1; }
mkdir -p "$OUT_DIR"
RUN_TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
REFRESH_ID="batch-$(date -u +%Y%m%d%H%M%S)"

UNAVAILABLE_PHRASES=(
  "abuse of free resources"
  "can only try 10 times"
  "increase the free quota after recharging"
  "free quota after recharging"
)

# 单次探测（SSE 流式，带 seed nonce）。输出一行 JSON：{id, verdict, ...}
probe_model() {
  local base="$1" key="$2" model="$3" timeout_ms="$4"
  local url="$base/chat/completions" nonce prompt body meta http ttft total resp_file
  local content usage_raw ct chars checked_at t
  t=$(( timeout_ms / 1000 )); [ "$t" -lt 1 ] && t=1
  checked_at="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

  nonce=$(uuidgen | tr -d '-' | cut -c1-16)
  prompt="Reply with exactly: pong  [seed:${nonce}]"
  body=$(jq -nc --arg m "$model" --arg p "$prompt" \
    '{model:$m,messages:[{role:"user",content:$p}],temperature:0,max_tokens:256,stream:true,stream_options:{include_usage:true}}')

  resp_file=$(mktemp)
  meta=$(curl -sN -m "$t" -w '%{http_code} %{time_starttransfer} %{time_total}' \
    -H "Authorization: Bearer $key" -H "Content-Type: application/json" \
    -H "accept: text/event-stream" -d "$body" "$url" -o "$resp_file")
  http=$(printf '%s' "$meta" | awk '{print $1}')
  ttft=$(printf '%s' "$meta" | awk '{print $2}')
  total=$(printf '%s' "$meta" | awk '{print $3}')
  local ttft_ms total_ms
  ttft_ms=$(awk "BEGIN{printf \"%.0f\", (${ttft:-0})*1000}")
  total_ms=$(awk "BEGIN{printf \"%.0f\", (${total:-0})*1000}")

  local verdict usage_obj='{"promptTokens":null,"completionTokens":null,"totalTokens":null}' tps=null
  content=""; usage_raw=""

  if [ "$http" != "200" ]; then
    case "$http" in
      429|500|502|503|504|000) verdict=limited ;;
      *) verdict=unavailable ;;
    esac
  else
    content=$(grep '^data:' "$resp_file" 2>/dev/null | sed 's/^data:[[:space:]]*//' \
      | grep -v '^\[DONE\]$' | jq -r '[.choices[]?.delta.content // empty] | add // ""' 2>/dev/null)
    usage_raw=$(grep '^data:' "$resp_file" 2>/dev/null | sed 's/^data:[[:space:]]*//' \
      | grep -v '^\[DONE\]$' | jq -c '[.usage // empty] | last // empty' 2>/dev/null)
    if [ -z "$content" ]; then
      verdict=limited
    else
      local lower ph
      lower=$(printf '%s' "$content" | tr '[:upper:]' '[:lower:]')
      verdict=free
      for ph in "${UNAVAILABLE_PHRASES[@]}"; do
        case "$lower" in *"$ph"*) verdict=unavailable; break ;; esac
      done
    fi
  fi
  rm -f "$resp_file"

  if [ "$verdict" = "free" ]; then
    if [ -n "$usage_raw" ] && [ "$usage_raw" != "empty" ]; then
      usage_obj=$(jq -nc --argjson u "$usage_raw" '{
        promptTokens: ($u.prompt_tokens // null),
        completionTokens: ($u.completion_tokens // null),
        totalTokens: ($u.total_tokens // null)}' 2>/dev/null) \
        || usage_obj='{"promptTokens":null,"completionTokens":null,"totalTokens":null}'
    fi
    ct=$(jq -r '.completionTokens // empty' <<<"$usage_obj")
    if [ -z "$ct" ]; then
      chars=$(printf '%s' "$content" | wc -c | tr -d ' ')
      ct=$(awk "BEGIN{printf \"%.0f\", (${chars:-0})/4}")
    fi
    tps=$(awk "BEGIN{ if (${total_ms:-0} > 0) printf \"%.4f\", (${ct:-0}) / (${total_ms}/1000); else print \"null\" }")
  fi

  jq -nc --arg id "$model" --arg verdict "$verdict" --arg http "$http" \
    --argjson latencyMs "$total_ms" --argjson ttftMs "$ttft_ms" --argjson tokensPerSec "$tps" \
    --arg prompt "$prompt" --arg content "$content" --argjson tokenUsage "$usage_obj" \
    --arg checkedAt "$checked_at" '{
      id:$id, verdict:$verdict, http:($http|tonumber? // 0),
      latencyMs:$latencyMs, ttftMs:$ttftMs, tokensPerSec:$tokensPerSec,
      availability:"available", freeStatus:"free",
      prompt:(if $verdict=="free" then $prompt else null end),
      content:(if $verdict=="free" then $content else null end),
      tokenUsage:(if $verdict=="free" then $tokenUsage else {promptTokens:null,completionTokens:null,totalTokens:null} end),
      checkedAt:$checkedAt
    }'
  echo "  [$model] $verdict http=${http:-000} latency=${total_ms}ms ttft=${ttft_ms}ms" >&2
}
export -f probe_model
export UNAVAILABLE_PHRASES

# 每个厂商的 free 候选来源策略：
#   pricing → 读 /models 的 pricing 字段（prompt+completion 全 0）—— openrouter
#   keyword → 按 freeKeywords 子串匹配（aihubmix 的 -free 后缀）
#   all     → 不预筛，测全部模型，靠响应判定 free（其余厂商）
free_source_for() {
  case "$1" in
    openrouter) echo pricing ;;
    rntm)       echo free-route ;;
    aihubmix|opencode|bynara) echo keyword ;;
    *)          echo all ;;
  esac
}

run_provider() {
  local p="$1"
  local id name base secret key timeoutMs kws free_source
  id=$(jq -r .id <<<"$p")
  name=$(jq -r .name <<<"$p")
  base=$(jq -r .baseUrl <<<"$p")
  secret=$(jq -r .secretName <<<"$p")
  timeoutMs=$(jq -r '.probe.timeoutMs // 25000' <<<"$p")
  [ -n "${PROBE_TIMEOUT_MS:-}" ] && timeoutMs="$PROBE_TIMEOUT_MS"
  kws=$(jq -r '.freeKeywords | join("|")' <<<"$p")
  key="${!secret:-}"

  local models_file="$OUT_DIR/$id.models.json"
  local pending="$OUT_DIR/$id.pending.txt"
  local final="$OUT_DIR/$id.final.jsonl"
  : > "$final"

  write_result() {  # $1=错误标记（可空）
    jq -c -n --arg id "$id" --arg name "$name" --arg base "$base" --arg secret "$secret" \
      --rawfile final "$final" '
      ($final | split("\n") | map(select(length>0) | fromjson) | group_by(.id) | map(last)) as $latest
      | ([$latest[] | select(.verdict=="free") | del(.verdict, .http)
          | {id, latencyMs, ttftMs, tokensPerSec, availability, freeStatus, prompt, content, tokenUsage, checkedAt}]
         | sort_by(.latencyMs, .id)) as $models
      | {id:$id, name:$name, baseUrl:$base, secretName:$secret,
         status:(if ($models|length)>0 then "healthy" else "empty" end), models:$models}
    ' > "$OUT_DIR/$id.result.json"
    local f l u
    read -r f l u < <(jq -rn --rawfile final "$final" '
      ($final|split("\n")|map(select(length>0)|fromjson)|group_by(.id)|map(last)) as $latest
      | [($latest|map(select(.verdict=="free"))|length),
         ($latest|map(select(.verdict=="limited"))|length),
         ($latest|map(select(.verdict=="unavailable"))|length)] | @tsv' | tr '\t' ' ')
    echo "[$id] free=$f limited=$l unavailable=$u${1:+ ($1)}"
  }

  if [ -z "$key" ]; then echo "[$id] 缺少 $secret，跳过" >&2; write_result "missing_key"; return; fi

  if ! curl -s -m 30 -H "Authorization: Bearer $key" "$base/models" -o "$models_file"; then
    write_result "models_fetch_failed"; return
  fi

  # 按 free 来源生成待探测候选（定价源预筛，避开全量 429）
  free_source="$(free_source_for "$id")"
  case "$free_source" in
    pricing)
      jq -r '(.data // [])[]
        | select(((.pricing.prompt? // "1")|tonumber? // 1)==0
             and ((.pricing.completion? // "1")|tonumber? // 1)==0)
        | .id' "$models_file" | sort > "$pending"
      ;;
    keyword)
      jq -r --arg re "$kws" '(.data // []) | map(.id) | sort
        | map(select(ascii_downcase | test($re))) | .[]' "$models_file" > "$pending"
      ;;
    free-route)
      jq -r '(.data // [])[] | select(.has_free_route==true) | .id' "$models_file" | sort > "$pending"
      ;;
    *)
      jq -r '(.data // []) | map(.id) | sort | .[]' "$models_file" > "$pending"
      ;;
  esac
  [ -n "${MAX_MODELS_OVERRIDE:-}" ] && { head -n "$MAX_MODELS_OVERRIDE" "$pending" > "$pending.tmp" && mv "$pending.tmp" "$pending"; }

  local total round start
  total=$(wc -l < "$pending" | tr -d ' ')
  echo "[$id] free来源=${free_source} 候选=${total}"
  if [ "${SKIP_PROBE:-0}" = "1" ]; then write_result; return; fi
  round=0
  start=$(date +%s)

  while [ -s "$pending" ] && [ "$round" -lt "$MAX_ROUNDS" ]; do
    round=$((round + 1))
    local round_out="$OUT_DIR/$id.round.jsonl"
    : > "$round_out"
    echo "[$id] 第 $round 轮：探测 $(wc -l < "$pending" | tr -d ' ') 个模型（并发 ${PROBE_CONCURRENCY}）"
    < "$pending" xargs -P "$PROBE_CONCURRENCY" -I{} bash -c \
      'probe_model "$1" "$2" "$3" "$4"' _ "$base" "$key" {} "$timeoutMs" >> "$round_out"
    cat "$round_out" >> "$final"

    # 下一轮只重试本轮 limited 的模型
    jq -r 'select(.verdict=="limited") | .id' "$round_out" > "$pending.next"
    mv "$pending.next" "$pending"

    if [ -s "$pending" ] && [ "$round" -lt "$MAX_ROUNDS" ]; then
      local elapsed=$(( $(date +%s) - start ))
      if [ "$elapsed" -ge "$DEADLINE_SECONDS" ]; then
        echo "[$id] 达时间预算 ${DEADLINE_SECONDS}s，剩余 $(wc -l < "$pending" | tr -d ' ') 个记为 limited"
        break
      fi
      sleep "$BACKOFF_SECONDS"
    fi
  done

  write_result
}

echo "== Free Model Radar 批量探测 @ $RUN_TS =="
echo "配置: $CONFIG  输出: $OUT_DIR/results.json  refreshId: $REFRESH_ID"
echo "并发=$PROBE_CONCURRENCY 最大轮数=$MAX_ROUNDS 退避=${BACKOFF_SECONDS}s 预算=${DEADLINE_SECONDS}s"
[ -n "${MAX_MODELS_OVERRIDE:-}" ] && echo "【试跑】每厂商模型上限: $MAX_MODELS_OVERRIDE"
echo

while IFS= read -r p; do
  if [ -n "${ONLY:-}" ] && [ "$(jq -r .id <<<"$p")" != "$ONLY" ]; then continue; fi
  if [ "${SERIAL:-0}" = "1" ]; then
    run_provider "$p"
  else
    run_provider "$p" &
  fi
done < <(jq -c '.providers[] | select(.enabled==true)' "$CONFIG")
wait

ORDER="$(jq -c '[.providers[] | select(.enabled==true) | .id]' "$CONFIG")"
ls "$OUT_DIR"/*.result.json 2>/dev/null | xargs -I{} cat {} | jq -s \
  --arg ts "$RUN_TS" --arg rid "$REFRESH_ID" --argjson order "$ORDER" '
  (reduce range(0; ($order | length)) as $i ({}; .[$order[$i]] = $i)) as $rank
  | {updatedAt: $ts, refreshId: $rid, providers: (sort_by($rank[.id] // 999))}
  ' > "$OUT_DIR/results.json"

echo
echo "== 汇总（free 模型数）=="
jq -r '.providers[] | "\(.id)\tstatus=\(.status)\tfree=\(.models|length)"' "$OUT_DIR/results.json"
echo
echo "总 free 模型: $(jq '[.providers[].models[]]|length' "$OUT_DIR/results.json")"
echo "完整结果: $OUT_DIR/results.json"
