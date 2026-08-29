# 设计稿 vs 前端实现 差异修复清单

> 生成日期：2026-08-29
> 对比对象：`docs/model-eval-dashboard.html`（设计稿）vs `app/`（Next.js 实现）
> 排查方式：三个子 agent 分区对比（顶部区域 / 模型评测视图 / 趋势分析视图）

## 处理结果（2026-08-29 实施）

- **P0、P1、P2、P3-1..7/9/10、P4-1/2 已全部完成**（typecheck / 63 tests / next build 全绿）。
- 新增：`src/lib/json-highlight.ts`、`src/lib/count-up.ts`、`src/lib/use-count-up.ts`（含单测）；重构收拢 `src/lib/provider-icon.ts`、`src/lib/ttft-tier.ts`（code-review 发现的重复代码）。
- 设计稿 `highlightJson` 存在链式 replace 自污染 bug，实现改为单遍 token 替换（见 json-highlight.ts 注释）。
- **未做（需产品确认）**：P3-8 文案对齐（含刷新按钮“重新探测”）、P4-3 新增断点保留确认、P5 全部（超出设计稿的实现，均保留）。
- 已知取舍：千分位与设计稿一致（KPI 无分隔符、prov-nums 有）；TPS 中位数摘要卡改为整数（设计稿 data-count 语义）；首行默认展开用 useEffect，SSR 首帧不展开。

## 总体结论

| 区域 | 结论 |
|------|------|
| 顶栏 / hero / KPI / tabs / footer | 基本一致，局部差异较大 |
| 模型评测视图（overview） | 差异较大 |
| 趋势分析视图（trend） | 差异较大 |

---

## P0 地基项（先做，否则后续修复会被覆盖或误判）

- [x] **P0-1 清理 `app/globals.css` 死代码**
  L1-2061 为旧实现样式（`.status-chip`、`.language-switch`、`.page-tabs`、`.metrics`、`.model-header`、`.expand-caret`、`.detail-json-code`、`.overview-row` 等），L2063 起才是按设计稿复刻的 reference skin 层。同名元素双重定义靠层叠取胜，先删除不再被 JSX 引用的旧规则。
- [x] **P0-2 修复旧规则覆盖 `--model-cols` 的问题**
  旧 `.model-item summary`（特异度 0-1-1）覆盖了新 `.model-row` 的 `--model-cols` 网格，实际列宽用的是 `--model-row-columns`（44→40px、168→140px、1.6fr→1.3fr），且旧规则给每个单元格加 `padding: 12px 0; display: flex`，导致 `m-num` 右对齐失效。P0-1 清理后需实测验证列宽与对齐恢复。
- [x] **P0-3 统一 `:root` token**
  - `--ink-faint`：实现 `#5A7380` → 设计稿 `#6E8896`（影响 eyebrow、topbar-ts、tab 默认色等大量次要文字对比度）
  - `--shadow`：`.25` → `.28`
  - 补齐缺失的 `--prov-bai` / `--prov-or` / `--prov-sn`
  - 补 `p { text-wrap: pretty }`、`h1,h2,h3 { text-wrap: balance }`
  - 补 `.num` / `.tabular` 工具类

## P1 功能缺失（用户可感知的能力缺口）

- [x] **P1-1 实现 `json-viewer` 整块**（overview 视图最大缺口）
  设计稿 L535-545 + L1085-1138：`rank-toggle` 恢复为 `<button aria-expanded aria-controls>`，点击展开/收起完整评测 JSON 查看器（标题 + "示例数据"徽标 + 复制 / 下载 .json / 收起三按钮 + 惰性渲染）。当前实现的 `rank-toggle` 是静态 `<span>`，无任何交互。
- [x] **P1-2 JSON 语法高亮**
  移植 `highlightJson()`（键 `.k` 紫 / 字符串 `.s` 绿 / 数字 `.num` 橙 / `.meta`），应用于 json-viewer 和每行 `m-detail` 展开详情（当前是纯文本 `<code>`）。
- [x] **P1-3 厂商链接可点击**
  `model-evaluation.tsx` L174 `m-prov-link` 由 `<span>` 改回 `<a href target="_blank" rel="noopener">`（设计稿 L566）。
- [x] **P1-4 趋势图 hover tooltip + 十字线**
  移植设计稿 `attachHover`（L999-1072）：`toSvg` 坐标换算、吸附最近采样点、`chart-cross` 虚线十字、其余曲线 dim 至 0.22、`chart-tip` 按数值降序列出全部曲线。当前仅有原生 `<title>`。
- [x] **P1-5 KPI 数字 count-up 动画**
  移植 `animateCount`（620ms 三次缓出，支持 `data-pad` 补零，reduced-motion 时直接落值），应用于 `.kpi-big` / `.kpi-value` / 趋势 `tsum`。同时确认千分位格式（实现 `1,013` vs 设计稿 `1013`）取哪个为准。

## P2 交互行为对齐

- [x] **P2-1 图例点击隐藏行为修正**（trend）
  设计稿：`hidden` 状态跨指标切换保留；Y 轴按全部数据计算，隐藏曲线不改变刻度。实现（`trend-analysis.tsx` L154-163、L302-308）：切 tab 后重置 + 隐藏后刻度重算跳动。两处均与设计稿相反。
- [x] **P2-2 复制反馈机制**（overview）
  设计稿：按钮原地变"已复制" + `.copied` 绿色态，1.4s 还原，失败也反馈。实现：中央 toast、仅成功时显示。二选一统一（建议保留 toast 但补 `.copied` 样式与失败反馈）。
- [x] **P2-3 视图切换动画 + 持久化**
  补 `.view` / `.view.active`（fade-in .3s），tab 选择持久化到 `localStorage('model-eval-view')`；tab ARIA 语义对齐（`role="tab"` + `aria-selected` + `data-view`）。
- [x] **P2-4 hover / active 反馈修复**（顶部区）
  - 补 `.tab:hover:not(.active)`（当前 hover 样式写在死类 `.page-tab` 上，P0-1 清理后会彻底丢失）
  - `.btn` / `.tab` / `.lang-opt` 补 `:active` 按压反馈（设计稿 `translateY(1px)`）
  - `.rank-toggle` 补 `cursor:pointer`、hover 变亮、`[aria-expanded="true"] .rank-caret` 旋转 180°
  - `.export-select` 补 `appearance:none`（去掉原生箭头）、hover、focus-visible
  - `.m-tab:hover:not(.active)` 补回（实现类 `.metric-tab` 无 hover 规则）
  - 统一触屏 hover 策略（旧层包 `@media (hover:hover)`，reference skin 层不包，两套混用）
- [x] **P2-5 指标切换文案联动**（trend）
  设计稿切指标时 `dimLabel` / `chartTitle` 随指标名变化（"首字耗时 TTFT · 越低越好"）；实现标题固定"全部模型趋势"。
- [x] **P2-6 `prov-nums` 着色语义**
  设计稿按数值档位着色（慢厂商的三个值全红）；实现按位置固定 min=绿/median=黄/max=红，慢厂商"最快值"仍显示绿色，语义相悖。
- [x] **P2-7 首个 `details.model-item` 默认展开**（设计稿 L562 带 `open`）。

## P3 视觉细节

- [x] **P3-1 趋势汇总卡（tsum）样式**：padding `14px 16px`、strong `26px` + mono 字体 + `letter-spacing:-.03em`、small `11px`、`.tsum.amber > strong { color: var(--accent) }`（实现均不同，amber 数字不变色）。
- [x] **P3-2 图表画布对齐**：viewBox `780×320`、pad `56/20/22/40`、Y 轴 min/max ± 12% padding 不从 0 起（实现 `900×280`、从 0 起，曲线被压扁）、`stroke-width 2.4` + 末端 `series-end` 圆点。
- [x] **P3-3 图例样式**：色块 8×8 圆角方块（实现 7×7 圆形）、item hover/focus 反馈、隐藏态 opacity `.42`（实现 `.36`）。
- [x] **P3-4 趋势表样式**：表头 mono 字体 + `letter-spacing:.04em`、行 `min-height:52px` + padding `0 16px` + 行 hover、`.trend-cell`/`.pill` 用 mono、网格列改用 `--trend-cols` 变量（当前硬编码且略窄）。
- [x] **P3-5 `accum-meter` 进度条**：补 6px 进度条 + `grow-bar 1s` 动画 + "N / 2 天"文案（实现只剩纯文字 `trend-pending`）。
- [x] **P3-6 顶部区细节**：`.topbar-ts` 补 `font-family: var(--font-mono)`；`.kpi-hero-top` `align-items: baseline` → `flex-start`；`.kpi-card .kpi-value small` 字号 13→12px、margin 5→4px、去 `font-weight:600`；`.kpi-who` 补 `margin-top:2px`；`.kpi-detail` 允许换行（当前 nowrap 截断）；`.footer` `margin-top` 18→24px + `flex-wrap:wrap`。
- [x] **P3-7 `.json-code` 换行策略**：设计稿 `white-space: pre`（横向滚动）vs 实现 `pre-wrap`，确认取哪个。
- [ ] **P3-8 文案对齐**（需产品确认，中英双语都要改）：
  - 表头："延迟区带" vs "延迟"；"首字耗时"/"吞吐 t/s"/"端到端 ms" vs 实现的带单位版本
  - 图例："≤ P50 ·最快" / "P50–P95 ·典型" / "> P95 ·慢" / "中位数标记" vs 实现的简化版
  - 刷新按钮："重新探测" vs "立即刷新"
  - 页面 `<title>`："模型评测看板 · free router" vs "Free Model Radar"
  - footer 第二行文案
  - `rank-toggle` tooltip：设计稿含 4 条指标公式定义（多行等宽），实现只有单行说明
- [x] **P3-9 `prov-scale` 标尺语义**：设计稿以 0 为基准（最快厂商条不贴最左），实现以 globalMin 归一化（最快恒贴左）。
- [x] **P3-10 `m-band-fill` 含义**：设计稿按延迟区带配色（`--lat-*` 变量），实现按综合分归一化 + 硬编码 hex。

## P4 响应式

- [x] **P4-1 `.kpis` 单列断点**：实现 720px → 设计稿 600px（600-720px 区间行为不同）。
- [x] **P4-2 1050px 趋势表数值列**：实现 `repeat(5,66px)` → 设计稿 `repeat(5,62px)`。
- [ ] **P4-3 确认新增断点保留与否**：实现多出 480px 档（隐藏首字耗时列/状态列、表格单列卡片化）与移动端表格双列重排，设计稿均无——属超纲增强，建议保留但在清单外记录。

## P5 超出设计稿的实现（需产品决策：保留 / 移除 / 反哺设计稿）

- [ ] 真实 i18n 中英切换（设计稿语言按钮是纯静态）
- [ ] 刷新按钮真实 POST `/api/refresh` + 轮询进度 + spin 图标
- [ ] `view-toggle` 综合排行 / 按厂商分组双视图
- [ ] 厂商分组趋势折叠面板（`details`）
- [ ] 图表失败红点 `chart-failure-dot`
- [ ] 空态 `empty-state`（`bucketDates < 2` 时整卡替换；设计稿恒有图 + accum-note 说明）
- [ ] 导出选项含 Zed / Cursor，复制真实 provider 配置（设计稿为 4 个写死示例模板）
- [ ] footer `status-dot` 脉冲动画（设计稿为静态圆点）
- [ ] `.gh-link:hover`（设计稿无 hover 规则）
- [ ] `color-scheme: dark`

## 附：已知双方一致的"死样式"（勿误判为差异）

- `.m-detail-metrics` / `.m-metric`：设计稿 CSS 定义但 HTML/JS 从未使用；实现同样定义同样未使用。
