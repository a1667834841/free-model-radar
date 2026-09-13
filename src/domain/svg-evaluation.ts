export const SVG_EVALUATION_PROMPT = '用 SVG 画一只鹈鹕骑自行车。只输出完整 SVG，不要解释或 Markdown；统一使用 viewBox="0 0 800 600"，并设置 width="800" height="600"。'
export const SVG_EVALUATION_PROMPT_VERSION = 2
export const SVG_EVALUATION_BATCH_SIZE = 10

export type SvgEvaluationStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'retryable'
  | 'success'
  | 'invalid_svg'
  | 'unsupported'
  | 'auth_blocked'

export type SvgEvaluationQueueMessage = {
  evaluationId: number
  promptVersion: number
  providerId: string
  modelId: string
}

export type SvgEvaluationPublicItem = {
  id: number
  providerId: string
  providerName: string
  modelId: string
  durationMs: number | null
  promptTokens: number | null
  completionTokens: number | null
  completedAt: string
  imageUrl: string
}

export type SvgEvaluationPublicResponse = {
  prompt: string
  promptVersion: number
  items: SvgEvaluationPublicItem[]
}
