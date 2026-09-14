<p align="center">
  <img src="public/fm-logo.svg" width="88" alt="Free Model Radar Logo">
</p>

<h1 align="center">Free Model Radar</h1>

<p align="center">
  持续实测免费大模型，并将可用模型统一为 OpenAI 兼容网关。
</p>

<p align="center">
  <a href="https://fm.ggball.top"><strong>在线体验</strong></a>
  ·
  <a href="docs/deployment.md"><strong>部署文档</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white" alt="Next.js 15">
  <img src="https://img.shields.io/badge/API-OpenAI_兼容-10A37F?logo=openai&logoColor=white" alt="OpenAI 兼容 API">
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/a1667834841/free-model-radar">
    <img src="https://deploy.workers.cloudflare.com/button" alt="一键部署到 Cloudflare">
  </a>
</p>

## 特点

| 功能 | 说明 |
|------|------|
| **真实测评** | 定时调用模型，验证可用性并实测首字延迟、生成速度和端到端延迟 |
| **效果评估** | 对比模型生成的 SVG 作品，展示上下文、多模态和思考模式等能力 |
| **统一网关** | 提供 OpenAI 兼容的 `/v1/*` 接口，支持指定厂商或使用 `model: "auto"` 自动选择最快模型 |
| **趋势分析** | 汇总近 7 天性能和成功率，观察模型速度与稳定性变化 |
| **Agent 配置** | 生成 Claude Code、Codex、OpenCode、Gemini CLI、Zed、Cursor 等工具的配置 |
| **自动化运行** | 使用 Cloudflare Cron、Queue、KV 和 D1 完成探测、存储与异常告警 |

![Free Model Radar 首页截图](docs/screenshot.png)

## 部署

点击上方 **Deploy to Cloudflare** 按钮，或查看[完整部署与配置说明](docs/deployment.md)。

[![实时厂商状态](https://fm.ggball.top/api/provider-status.zh-CN.svg)](https://fm.ggball.top)

> 免费模型、额度和账户要求可能随时变化；页面展示的是实际探测结果，不代表厂商的长期服务承诺。
