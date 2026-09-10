# 模型费用判断规则

可用性和费用独立判断。HTTP 200 仅表示本次请求成功，不证明免费。

## 判断顺序

1. 输入或输出存在明确正价：付费。优先于免费标记、名称和人工配置。
2. 目录明确返回 `is_free: false`、`free: false` 或 `has_free_route: false`：不确认免费，默认不探测。
3. 输入和输出价格均明确为零：零价。空字符串、缺失、负数、非有限数字不作为零价证据。
4. `is_free: true` 或 `free: true`：免费额度，仍可能受账号条件限制。
5. 使用人工配置：模型 ID 精确匹配优先于厂商默认类型。
6. 其他情况：费用未知。名称包含 `free` 和存在免费路由只作为候选线索。

每次分类保存 `type`、`source`、`evidence`、`checkedAt`。价格仅代表目录查询时的信息，不保证未来价格或账号实际扣费。

## 厂商配置示例

以下字段添加到已有厂商配置中。示例为假设规则，不是任何厂商的实际计费承诺。

```json
{
  "billing": {
    "defaultType": "unknown",
    "source": "账号套餐说明或已核对的官方文档地址",
    "models": {
      "model-with-quota": "free-quota",
      "model-with-trial-credit": "trial",
      "paid-model": "paid"
    }
  },
  "probe": {
    "costPolicy": "allow-unknown",
    "maxModels": 20,
    "concurrency": 3,
    "attempts": 1,
    "timeoutMs": 25000
  }
}
```

费用类型：`free`（零价）、`free-quota`（免费额度）、`trial`（试用赠金）、`paid`（付费）、`unknown`（未知）。

探测策略：

- `free-only`：只探测零价或免费额度模型。免费额度仍可能耗尽。
- `allow-unknown`：默认策略。优先免费及名称候选，无候选时保留原有小目录回退，跳过已知付费及试用模型。未知费用请求可能产生费用。
- `all`：允许全部费用类型，包括付费和试用；仍遵守模型数量限制。

所有策略均遵守 `maxModels`。未配置新字段时无需迁移厂商配置。

旧快照没有费用证据时显示“费用未知”，读取时不再作为免费模型导出。后续目录发现会更新已有模型的费用分类，即使模型尚未到复测时间或因付费策略被跳过；仅更新费用不会推进可用性快照时间。本次变更不会修改远端 KV。批量 shell 探测脚本只报告可用，不产生免费结论。
