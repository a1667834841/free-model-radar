# free-model-radar 当前可用模型能力研究（2026-09-07）

## 口径说明

- 模型范围来自线上接口 `https://free-model-radar.1667834841.workers.dev/api/results`，接口 `updatedAt` 为 `2026-09-07T11:33:17.881Z`，仅纳入 `availability = available` 的模型，共 106 条。
- 能力来源仅采用官方文档、官方模型 API、厂商模型目录、厂商 GitHub/Hugging Face 模型卡等一手来源。未找到可公开验证的一手信息时，表中写作“未找到公开权威信息”。
- `上下文长度`列只填写长度值，统一用 K/M tokens 表示；如精确模型 ID 未公开，则按可验证的底层模型长度填写，别名/底层说明放在“来源 / 备注”中。
- `大语言模型`按来源是否将其描述为语言模型、文本/聊天/推理模型、视觉语言模型，或官方 API 是否以聊天/文本生成为主要接口判断；路由器或复合系统单独标注。
- `多模态`指官方公开支持非文本输入或非文本输出。`向量模型`指输出 embedding 或官方端点为 embeddings。`可生图`指官方明确支持图像输出或图像生成端点；只有图像输入不算可生图。
- 对 `-free`、`coding-`、`fk-hs` 等供应商包装别名：若供应商公开目录未给完整能力，表中只记录可公开验证的底层模型能力，并注明该别名自身限制未公开。

## 当前可用模型能力表

| 供应商 | 模型 ID | 上下文长度 | 大语言模型 | 多模态 | 向量模型 | 可生图 | 来源 / 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenRouter | `minimax/minimax-m3:free` | 1.05M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| OpenRouter | `nvidia/nemotron-3-nano-30b-a3b` | 262K tokens | 是 | 否 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| OpenRouter | `inclusionai/ling-3.0-flash-sante:free` | 262K tokens | 是 | 否 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| OpenRouter | `openrouter/free` | 200K tokens | 否，模型路由器 | 是，文本/图像输入，文本输出 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| OpenRouter | `minimax/minimax-m2.5` | 205K tokens | 是 | 否 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| OpenRouter | `~z-ai/glm-latest` | 1.31M tokens | 是 | 否 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| Bynara | `minimax-m3-free` | 1M tokens | 是 | 是，底层支持图像/视频输入 | 否 | 否 | [MiniMax M3 官方博客](https://www.minimax.io/blog/minimax-m3)；Bynara `/models` 需鉴权 |
| Bynara | `longcat-2.0-free` | 1M tokens | 是 | 未找到公开权威信息 | 否 | 否 | [LongCat 官方站点](https://longcat.ai/)；[LongCat 平台更新日志](https://longcat.chat/platform/docs/ChangeLog.html) |
| Bynara | `muse-spark-1.2-contributor-free` | 未找到公开权威信息 | 未找到公开权威信息 | 未找到公开权威信息 | 未找到公开权威信息 | 未找到公开权威信息 | 未找到 Meta 对 `Muse Spark 1.2 Contributor` 的公开权威规格；Bynara `/models` 需鉴权 |
| SenseNova | `glm-5.2` | 1M tokens | 是 | 否 | 否 | 否 | [Z.AI GLM-5.2](https://docs.z.ai/guides/llm/glm-5.2)；SenseNova 别名限制未找到公开权威信息 |
| SenseNova | `deepseek-v4-pro` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；SenseNova 别名限制未找到公开权威信息 |
| SenseNova | `sensenova-6.8-flash-lite` | 未找到公开权威信息 | 是 | 是，官方说明支持文本、图像、图表、文档、视频、网页/应用界面理解 | 否 | 否 | [OpenSenseNova/SenseNova6.8](https://github.com/OpenSenseNova/SenseNova6.8)；[API.md](https://github.com/OpenSenseNova/SenseNova6.8/blob/main/API.md) |
| SenseNova | `deepseek-v4-flash` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；SenseNova 别名限制未找到公开权威信息 |
| B.AI | `qwen3.8-27b` | 1M tokens | 是 | 是，文本/视觉理解 | 否 | 否 | [阿里云 Model Studio qwen3.8-27b](https://help.aliyun.com/en/model-studio/qwen3-8-27b)；B.AI `/models` 需鉴权 |
| B.AI | `deepseek-v4-flash-vision-exp` | 1M tokens | 是 | 是，图像输入 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；[DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/)；B.AI 别名限制未公开 |
| B.AI | `glm-5.3-flash` | 1M tokens | 是 | 是，视频/图像/文本/文件输入，文本输出 | 否 | 否 | [Z.AI GLM-5.3-Flash](https://docs.z.ai/guides/vlm/glm-5.3-flash)；B.AI 别名限制未公开 |
| B.AI | `hy3` | 256K tokens | 是 | 否 | 否 | 否 | [Tencent Hy3 模型卡](https://huggingface.co/tencent/Hy3)；[腾讯发布稿](https://www.tencent.com/tencent-unveils-hy3-preview-model-enhances-agent-capabilities-and-real-world-usability/)；B.AI 别名限制未公开 |
| B.AI | `deepseek-v4-flash` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；B.AI 别名限制未公开 |
| B.AI | `minimax-m2.7` | 205K tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM MiniMax-M2.7](https://docs.api.nvidia.com/nim/reference/minimaxai-minimax-m2.7)；B.AI 别名限制未公开 |
| B.AI | `hy4-preview` | 1M tokens | 是 | 否 | 否 | 否 | [腾讯云 TokenHub 模型列表](https://intl.cloud.tencent.com/document/product/1300/78934)；[Tencent-Hunyuan/Hy4-preview](https://github.com/Tencent-Hunyuan/Hy4-preview)；B.AI 别名限制未公开 |
| B.AI | `qwen3.8-flash` | 1M tokens | 是 | 是，文本/视觉理解 | 否 | 否 | [阿里云 Model Studio qwen3.8-flash](https://help.aliyun.com/en/model-studio/qwen3-8-flash)；B.AI 别名限制未公开 |
| RNTM | `ling-3.0-flash-sante` | 262K tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| RNTM | `free` | 200K tokens | 否，模型路由器 | 是，文本/图像输入，文本输出 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[OpenRouter Models API](https://openrouter.ai/api/v1/models) |
| RNTM | `north-mini-code` | 256K tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[Cohere North Mini Code](https://cohere.com/blog/north-mini-code) |
| RNTM | `dots-3-note-preview` | 512K tokens | 是 | 是，文本/图像/视频/音频输入，文本输出 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[Dots 官方 GitHub](https://github.com/studio-dots-ai/dots3-note-prev) |
| RNTM | `minimax-m3` | 1M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[MiniMax M3 官方博客](https://www.minimax.io/blog/minimax-m3) |
| RNTM | `lfm-2.5-2.6b` | 128K tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[OpenRouter Models API](https://openrouter.ai/api/v1/models)；[Liquid LFM2.5-2.6B](https://docs.liquid.ai/lfm/models/lfm25-2.6b) |
| RNTM | `nemotron-3.5-content-safety` | 128K tokens | 是，安全分类/守护模型 | 是，文本/图像输入，文本输出 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[NVIDIA NIM Content Safety](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-content-safety) |
| RNTM | `nemotron-3-super-120b-a12b` | 1M tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[OpenRouter Models API](https://openrouter.ai/api/v1/models)；[NVIDIA NIM Super](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b) |
| RNTM | `minimax-m2.7` | 205K tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[OpenRouter Models API](https://openrouter.ai/api/v1/models)；[NVIDIA NIM MiniMax-M2.7](https://docs.api.nvidia.com/nim/reference/minimaxai-minimax-m2.7) |
| RNTM | `nemotron-3.5-lightning` | 1M tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[NVIDIA NIM Lightning](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b) |
| RNTM | `nemotron-3-ultra-550b-a55b` | 1M tokens | 是 | 否 | 否 | 否 | [RNTM Models API](https://api.rntm.sh/v1/models)；[NVIDIA NIM Ultra](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b) |
| AIHubMix | `gpt-4o-free` | 1.05M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [AIHubMix gpt-4o-free llms.txt](https://aihubmix.com/model/gpt-4o-free/llms.txt)；[OpenAI GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o) |
| AIHubMix | `gpt-4.1-mini-free` | 1.05M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [AIHubMix gpt-4.1-mini-free llms.txt](https://aihubmix.com/model/gpt-4.1-mini-free/llms.txt)；[OpenAI GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) |
| AIHubMix | `gpt-5.5-free` | 1.05M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/gpt-5.5-free.dfdf9e2d.json)；[OpenAI GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5) |
| AIHubMix | `gpt-4.1-nano-free` | 1.05M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [AIHubMix gpt-4.1-nano-free llms.txt](https://aihubmix.com/model/gpt-4.1-nano-free/llms.txt)；[OpenAI GPT-4.1 Nano](https://developers.openai.com/api/docs/models/gpt-4.1-nano) |
| AIHubMix | `gemini-3.5-flash-lite-free` | 1.05M tokens | 是 | 是，文本/图像/视频/音频/PDF 输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/gemini-3.5-flash-lite-free.58416af1.json)；[Google Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) |
| AIHubMix | `gemini-3-flash-preview-free` | 1.05M tokens | 是 | 是，文本/图像/视频/音频/PDF 输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/gemini-3-flash-preview-free.d589a8dd.json)；[Google Gemini 3 Flash Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview) |
| AIHubMix | `gpt-4.1-free` | 1.05M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [AIHubMix gpt-4.1-free llms.txt](https://aihubmix.com/model/gpt-4.1-free/llms.txt)；[OpenAI GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1) |
| AIHubMix | `coding-glm-5.3-free` | 1.05M tokens | 是 | 否，AIHubMix 该别名标为 text；底层 GLM-5.3 为文本模型 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/coding-glm-5.3-free.f62c20b3.json)；[Z.AI GLM-5.3](https://docs.z.ai/guides/llm/glm-5.3) |
| AIHubMix | `coding-glm-5.1-free` | 200K tokens | 是 | 否 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/coding-glm-5.1-free.815ceb33.json)；[Z.AI GLM-5.1](https://docs.z.ai/guides/llm/glm-5.1) |
| AIHubMix | `gemini-3.6-flash-free` | 1.05M tokens | 是 | 是，文本/图像/视频/音频/PDF 输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/gemini-3.6-flash-free.68ab525a.json)；[Google Gemini Models](https://ai.google.dev/gemini-api/docs/models) |
| AIHubMix | `coding-minimax-m3-free` | 1M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/coding-minimax-m3-free.f4f99210.json)；[MiniMax M3 官方博客](https://www.minimax.io/blog/minimax-m3) |
| AIHubMix | `gemini-3.8-flash-free` | 1.05M tokens | 是 | 是，文本/图像/视频/音频/PDF 输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/gemini-3.8-flash-free.186ebe00.json)；[Google Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) |
| AIHubMix | `gemini-3.7-flash-free` | 1.05M tokens | 是 | 是，文本/图像/视频/音频/PDF 输入，文本输出 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/gemini-3.7-flash-free.b34f2725.json)；[Google Gemini Models](https://ai.google.dev/gemini-api/docs/models) |
| AIHubMix | `coding-minimax-m2-free` | 200K tokens | 是 | 否 | 否 | 否 | [MiniMax API Docs](https://platform.minimax.io/docs/guides/models-intro)；[AIHubMix model page](https://aihubmix.com/model/coding-minimax-m2-free) |
| AIHubMix | `glm-4.7-flash-free` | 200K tokens | 是 | 否 | 否 | 否 | [Z.AI GLM-4.7](https://docs.z.ai/guides/llm/glm-4.7)；[AIHubMix model page](https://aihubmix.com/model/glm-4.7-flash-free) |
| AIHubMix | `coding-minimax-m2.1-free` | 200K tokens | 是 | 否 | 否 | 否 | [MiniMax API Docs](https://platform.minimax.io/docs/guides/models-intro)；[AIHubMix model page](https://aihubmix.com/model/coding-minimax-m2.1-free) |
| AIHubMix | `coding-minimax-m2.5-free` | 205K tokens | 是 | 否 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/coding-minimax-m2.5-free.0684c9d9.json)；[MiniMax API Docs](https://platform.minimax.io/docs/guides/models-intro) |
| AIHubMix | `coding-glm-5.2-free` | 1M tokens | 是 | 否 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/coding-glm-5.2-free.876712a7.json)；[Z.AI GLM-5.2](https://docs.z.ai/guides/llm/glm-5.2) |
| AIHubMix | `coding-glm-4.6-free` | 200K tokens | 是 | 否 | 否 | 否 | [Z.AI GLM-4.6](https://docs.z.ai/guides/llm/glm-4.6)；[AIHubMix model page](https://aihubmix.com/model/coding-glm-4.6-free) |
| AIHubMix | `coding-glm-4.7-free` | 200K tokens | 是 | 否 | 否 | 否 | [Z.AI GLM-4.7](https://docs.z.ai/guides/llm/glm-4.7)；[AIHubMix model page](https://aihubmix.com/model/coding-glm-4.7-free) |
| AIHubMix | `coding-glm-5-free` | 200K tokens | 是 | 否 | 否 | 否 | [AIHubMix model-data](https://aihubmix.com/model-data/models/coding-glm-5-free.7665c1db.json)；[Z.AI GLM-5](https://docs.z.ai/guides/llm/glm-5) |
| OpenCode ZEN | `ling-3.0-flash-fin-free` | 262K tokens | 是 | 否 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models)；OpenCode `/v1/models` 返回 Not Found |
| OpenCode ZEN | `laguna-s-2.1-free` | 262K tokens | 是 | 否 | 否 | 否 | [Poolside 官网](https://poolside.ai/)；[vLLM Laguna-S-2.1 recipe](https://recipes.vllm.ai/poolside/Laguna-S-2.1) |
| GMI Cloud | `MiniMaxAI/MiniMax-M3` | 1M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [MiniMax M3 官方博客](https://www.minimax.io/blog/minimax-m3) |
| GMI Cloud | `MiniMaxAI/MiniMax-M2.7` | 205K tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM MiniMax-M2.7](https://docs.api.nvidia.com/nim/reference/minimaxai-minimax-m2.7) |
| ZenMux | `z-ai/glm-4.6v-flash-free` | 200K tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [ZenMux Models API](https://zenmux.ai/api/v1/models)；[Z.AI GLM-4.6V](https://docs.z.ai/guides/vlm/glm-4.6v) |
| ZenMux | `dots-studio/dots3-note-prev` | 393K tokens | 是 | 是，文本/图像/视频/音频输入，文本输出 | 否 | 否 | [ZenMux Models API](https://zenmux.ai/api/v1/models)；底层官方为 512K tokens，见 [Dots GitHub](https://github.com/studio-dots-ai/dots3-note-prev) |
| ZenMux | `z-ai/glm-4.7-flash-free` | 200K tokens | 是 | 否 | 否 | 否 | [ZenMux Models API](https://zenmux.ai/api/v1/models)；[Z.AI GLM-4.7](https://docs.z.ai/guides/llm/glm-4.7) |
| NVIDIA NIM | `nvidia/nemotron-3.5-content-safety` | 128K tokens | 是，安全分类/守护模型 | 是，文本/图像输入，文本输出 | 否 | 否 | [NVIDIA NIM Content Safety](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-content-safety) |
| NVIDIA NIM | `minimaxai/minimax-m3` | 1M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [NVIDIA Models API](https://integrate.api.nvidia.com/v1/models)；[MiniMax M3 官方博客](https://www.minimax.io/blog/minimax-m3) |
| NVIDIA NIM | `nvidia/riva-translate-4b-instruct-v2` | 8K tokens | 是，专用翻译模型 | 否 | 否 | 否 | [NVIDIA NIM Riva Translate v2](https://docs.api.nvidia.com/nim/reference/nvidia-riva-translate-4b-instruct-v2) |
| NVIDIA NIM | `meta/muse-glimmer-30b` | 131K tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [NVIDIA NIM Muse Glimmer](https://docs.api.nvidia.com/nim/reference/meta-muse-glimmer-30b)；[Meta 模型卡](https://huggingface.co/meta-models/Muse-Glimmer-30B) |
| NVIDIA NIM | `nvidia/nemotron-3-ultra-550b-a55b` | 1M tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM Ultra](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b) |
| NVIDIA NIM | `google/diffusiongemma-26b-a4b-it` | 262K tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [NVIDIA NIM DiffusionGemma](https://docs.api.nvidia.com/nim/reference/google-diffusiongemma-26b-a4b-it)；[Google 模型卡](https://huggingface.co/google/diffusiongemma-26B-A4B-it) |
| NVIDIA NIM | `nvidia/ising-calibration-1.5-31b` | 262K tokens | 是，量子校准 VLM 专用模型 | 是，文本/图像输入，文本输出 | 否 | 否 | [NVIDIA Build Ising](https://build.nvidia.com/nvidia/ising-calibration-1.5-31b)；[NVIDIA NIM Ising](https://docs.api.nvidia.com/nim/reference/nvidia-ising-calibration-1-5-31b) |
| NVIDIA NIM | `moonshotai/kimi-k3` | 1.05M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [MoonshotAI/Kimi-K3](https://github.com/MoonshotAI/Kimi-K3)；[Kimi-K3 模型卡](https://huggingface.co/moonshotai/Kimi-K3) |
| NVIDIA NIM | `nvidia/nemotron-3.5-lightning-30b-a3b` | 最高 1M tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM Lightning](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b) |
| NVIDIA NIM | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | 256K tokens | 是 | 是，文本/图像/视频/音频输入，文本输出 | 否 | 否 | [NVIDIA NIM Nano Omni](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning) |
| NVIDIA NIM | `poolside/laguna-xs-2.1` | 262K tokens | 是 | 否 | 否 | 否 | [NVIDIA Build Laguna XS](https://build.nvidia.com/poolside/laguna-xs-2.1/modelcard) |
| NVIDIA NIM | `deepseek-ai/deepseek-v4-flash-0731` | 1M tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM DeepSeek V4 Flash](https://docs.api.nvidia.com/nim/reference/deepseek-ai-deepseek-v4-flash-0731) |
| NVIDIA NIM | `deepseek-ai/deepseek-v4-pro-0813` | 1M tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM DeepSeek V4 Pro](https://docs.api.nvidia.com/nim/reference/deepseek-ai-deepseek-v4-pro-0813) |
| GoRouter | `claude-opus-5` | 1M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [Anthropic Models Overview](https://docs.anthropic.com/en/docs/about-claude/models/overview)；[Claude Code model config](https://docs.anthropic.com/en/docs/claude-code/model-config)；GoRouter `/models` 需鉴权 |
| GoRouter | `claude-opus-5-thinking` | 1M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [Anthropic Models Overview](https://docs.anthropic.com/en/docs/about-claude/models/overview)；[Claude thinking](https://docs.anthropic.com/en/docs/about-claude/models/extended-thinking-models) |
| GoRouter | `claude-opus-4-8-thinking` | 1M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [Anthropic release notes](https://docs.anthropic.com/en/release-notes/api)；[Claude thinking](https://docs.anthropic.com/en/docs/about-claude/models/extended-thinking-models) |
| GoRouter | `claude-opus-4-8` | 1M tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [Anthropic release notes](https://docs.anthropic.com/en/release-notes/api)；[Anthropic Models Overview](https://docs.anthropic.com/en/docs/about-claude/models/overview) |
| Groq Cloud | `qwen/qwen3.8-27b` | 131K tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [Groq qwen3.8-27b](https://console.groq.com/docs/model/qwen/qwen3.8-27b)；[Groq Vision](https://console.groq.com/docs/vision) |
| Groq Cloud | `allam-2-7b` | 4K tokens | 是 | 否 | 否 | 否 | [Groq ALLaM 2 7B](https://console.groq.com/docs/model/allam-2-7b) |
| Groq Cloud | `openai/gpt-oss-20b` | 128K tokens | 是 | 否 | 否 | 否 | [OpenAI gpt-oss](https://openai.com/index/introducing-gpt-oss/)；[Groq Supported Models](https://console.groq.com/docs/models) |
| Groq Cloud | `openai/gpt-oss-safeguard-20b` | 未找到公开权威信息 | 是，安全分类/守护模型 | 否 | 否 | 否 | [OpenAI gpt-oss-safeguard](https://openai.com/index/introducing-gpt-oss-safeguard/)；Groq 对该精确 ID 的上下文未公开可验证 |
| Groq Cloud | `openai/gpt-oss-120b` | 128K tokens | 是 | 否 | 否 | 否 | [OpenAI gpt-oss](https://openai.com/index/introducing-gpt-oss/)；[Groq Supported Models](https://console.groq.com/docs/models) |
| Groq Cloud | `qwen/qwen3.6-27b` | 131K tokens | 是 | 是，文本/图像输入，文本输出 | 否 | 否 | [Groq Vision](https://console.groq.com/docs/vision)；[Groq qwen3.6-27b](https://console.groq.com/docs/model/qwen/qwen3.6-27b) |
| Groq Cloud | `groq/compound-mini` | 131K tokens | 否，复合 AI 系统 | 否，官方只列文本系统能力 | 否 | 否 | [Groq Supported Models](https://console.groq.com/docs/models)；[Groq Compound Mini](https://console.groq.com/docs/compound/systems/compound-mini) |
| Groq Cloud | `groq/compound` | 131K tokens | 否，复合 AI 系统 | 否，官方只列文本系统能力 | 否 | 否 | [Groq Supported Models](https://console.groq.com/docs/models)；[Groq Compound](https://console.groq.com/docs/compound/systems/compound) |
| AMD Radeon Cloud | `MiniCPM5-1B` | 131K tokens | 是 | 否 | 否 | 否 | [MiniCPM5-1B 模型卡](https://huggingface.co/openbmb/MiniCPM5-1B) |
| AMD Radeon Cloud | `DeepSeek-V4-Flash-Vision-Exp` | 1M tokens | 是 | 是，图像输入 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；[DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/)；AMD `/models` 需鉴权 |
| AMD Radeon Cloud | `GLM-5.3-Flash` | 1M tokens | 是 | 是，视频/图像/文本/文件输入，文本输出 | 否 | 否 | [Z.AI GLM-5.3-Flash](https://docs.z.ai/guides/vlm/glm-5.3-flash)；AMD `/models` 需鉴权 |
| AMD Radeon Cloud | `DeepSeek-V4-Flash` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；AMD `/models` 需鉴权 |
| AMD Radeon Cloud | `MiniCPM-V46` | 256K/262K tokens | 是 | 是，图像/视频理解，文本输出 | 否 | 否 | [OpenBMB MiniCPM-V](https://github.com/openbmb/MiniCPM-V)；[SGLang MiniCPM-V-4.6](https://lmsysorg.mintlify.app/cookbook/autoregressive/OpenBMB/MiniCPM-V-4_6) |
| AMD Radeon Cloud | `Qwen3.8-Flash-Next` | 262K tokens | 是 | 是，底层为多模态 | 否 | 否 | [Qwen3.8-Flash-Next 模型卡](https://huggingface.co/Qwen/Qwen3.8-Flash-Next)；AMD `/models` 需鉴权 |
| Flatkey | `deepseek-v4-flash` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；Flatkey `/models` 需鉴权 |
| Flatkey | `deepseek-v4-flash-fk-hs` | 未找到公开权威信息 | 未找到公开权威信息 | 未找到公开权威信息 | 未找到公开权威信息 | 未找到公开权威信息 | Flatkey `/models` 需鉴权；未找到该精确 ID 的公开权威来源 |
| Experiential Labs | `minimax-m3-free` | 1M tokens | 是 | 是，文本/图像/视频输入，文本输出 | 否 | 否 | [MiniMax M3 官方博客](https://www.minimax.io/blog/minimax-m3)；Experiential Labs `/models` 需鉴权 |
| Experiential Labs | `deepseek-v4-flash-0731` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；Experiential Labs `/models` 需鉴权 |
| Experiential Labs | `deepseek-v4-flash-vision-exp` | 1M tokens | 是 | 是，图像输入 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；[DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/) |
| Experiential Labs | `ling-3.0-flash-fin-free` | 262K tokens | 是 | 否 | 否 | 否 | [OpenRouter Models API](https://openrouter.ai/api/v1/models)；Experiential Labs `/models` 需鉴权 |
| Experiential Labs | `deepseek-v4-flash` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)；Experiential Labs `/models` 需鉴权 |
| Experiential Labs | `nemotron-3-ultra-550b-a55b-free` | 1M tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM Ultra](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b) |
| Experiential Labs | `north-mini-code-free` | 256K tokens | 是 | 否 | 否 | 否 | [Cohere North Mini Code](https://cohere.com/blog/north-mini-code) |
| Experiential Labs | `deepseek-v4-flash-latest` | 1M tokens | 是 | 否 | 否 | 否 | [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/) |
| Experiential Labs | `laguna-s-2.1-free` | 262K tokens | 是 | 否 | 否 | 否 | [Poolside 官网](https://poolside.ai/)；[vLLM Laguna-S-2.1 recipe](https://recipes.vllm.ai/poolside/Laguna-S-2.1) |
| Experiential Labs | `minimax-m2.7-free` | 205K tokens | 是 | 否 | 否 | 否 | [NVIDIA NIM MiniMax-M2.7](https://docs.api.nvidia.com/nim/reference/minimaxai-minimax-m2.7) |
| Experiential Labs | `nemotron-3.5-content-safety-free` | 128K tokens | 是，安全分类/守护模型 | 是，文本/图像输入，文本输出 | 否 | 否 | [NVIDIA NIM Content Safety](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-content-safety) |
| Experiential Labs | `nemotron-3-nano-omni-30b-a3b-reasoning-free` | 256K tokens | 是 | 是，文本/图像/视频/音频输入，文本输出 | 否 | 否 | [NVIDIA NIM Nano Omni](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning) |
| Experiential Labs | `qwen3.8-27b` | 1M tokens | 是 | 是，文本/视觉理解 | 否 | 否 | [阿里云 Model Studio qwen3.8-27b](https://help.aliyun.com/en/model-studio/qwen3-8-27b) |

## 主要未确认项

- `muse-spark-1.2-contributor-free`：未找到 Meta 官方或 Bynara 官方公开规格。Meta 官方公开资料覆盖 Muse Spark / Muse Spark 1.1，但本轮未找到 `1.2 Contributor` 精确版本的一手规格。
- `deepseek-v4-flash-fk-hs`：未找到 Flatkey 对该精确 high-speed 包装 ID 的公开规格。
- 多数聚合供应商的 `-free` / `coding-` 包装 ID 未公开完整能力字段；表中已尽量记录底层模型官方能力，但不把它等同于该供应商运行时的限额保证。
- 本轮没有发现当前 106 条可用模型中存在明确的 embedding/向量模型或图像输出/生图模型；可验证的多模态能力几乎都属于图像、视频、音频、PDF 输入到文本输出。

## 参考来源

- free-model-radar 当前结果：<https://free-model-radar.1667834841.workers.dev/api/results>
- OpenRouter Models API：<https://openrouter.ai/api/v1/models>
- RNTM Models API：<https://api.rntm.sh/v1/models>
- ZenMux Models API：<https://zenmux.ai/api/v1/models>
- AIHubMix Models API：<https://aihubmix.com/v1/models>
- AIHubMix Model Data Index：<https://aihubmix.com/model-data/index.json>
- NVIDIA Models API：<https://integrate.api.nvidia.com/v1/models>
- NVIDIA NIM API Docs：<https://docs.api.nvidia.com/nim/>
- NVIDIA Build Models：<https://build.nvidia.com/models>
- OpenAI Models：<https://developers.openai.com/api/docs/models>
- OpenAI gpt-oss：<https://openai.com/index/introducing-gpt-oss/>
- OpenAI gpt-oss-safeguard：<https://openai.com/index/introducing-gpt-oss-safeguard/>
- Google Gemini Models：<https://ai.google.dev/gemini-api/docs/models>
- Z.AI Developer Docs：<https://docs.z.ai/>
- DeepSeek API Docs：<https://api-docs.deepseek.com/>
- Groq Docs：<https://console.groq.com/docs/models>
- Anthropic Claude Docs：<https://docs.anthropic.com/en/docs/about-claude/models/overview>
- MiniMax API Docs：<https://platform.minimax.io/docs/guides/models-intro>
- MiniMax M3 官方博客：<https://www.minimax.io/blog/minimax-m3>
- Cohere North Mini Code：<https://cohere.com/blog/north-mini-code>
- Liquid LFM2.5-2.6B：<https://docs.liquid.ai/lfm/models/lfm25-2.6b>
- MoonshotAI Kimi-K3：<https://github.com/MoonshotAI/Kimi-K3>
- Dots3 Note Preview：<https://github.com/studio-dots-ai/dots3-note-prev>
- Tencent TokenHub 模型列表：<https://intl.cloud.tencent.com/document/product/1300/78934>
- Tencent Hy3 模型卡：<https://huggingface.co/tencent/Hy3>
- Tencent Hy4-preview：<https://github.com/Tencent-Hunyuan/Hy4-preview>
- OpenBMB MiniCPM：<https://github.com/openbmb/minicpm>
- OpenBMB MiniCPM-V：<https://github.com/openbmb/MiniCPM-V>
- OpenSenseNova SenseNova6.8：<https://github.com/OpenSenseNova/SenseNova6.8>
- LongCat 官方站点：<https://longcat.ai/>
