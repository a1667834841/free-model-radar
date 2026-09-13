import { SVG_EVALUATION_PROMPT } from '@/domain/svg-evaluation'
import { svgEvaluationInternals } from '@/services/svg-evaluation-service'
import { svgGeneratorInternals } from '@/services/svg-generator'
import { generateSvg } from '@/services/svg-generator'
import { sanitizeSvgResponse } from '@/services/svg-sanitizer'
import type { ProviderConfig } from '@/domain/provider'

const provider: ProviderConfig = {
  id: 'provider-a',
  name: 'Provider A',
  baseUrl: 'https://api.example.com/v1',
  secretName: 'PROVIDER_A_KEY',
  enabled: true,
  modelStrategy: 'free-first',
  freeKeywords: ['free'],
  probe: { maxModels: 10, concurrency: 1, attempts: 1, timeoutMs: 10_000 },
}

describe('SVG 效果测评', () => {
  it('使用固定中文提示词', () => {
    expect(SVG_EVALUATION_PROMPT).toContain('viewBox="0 0 800 600"')
    expect(SVG_EVALUATION_PROMPT).toContain('width="800" height="600"')
    expect(svgGeneratorInternals.SVG_GENERATION_TIMEOUT_MS).toBe(600_000)
  })

  it('提取并清洗 Markdown 中的 SVG', () => {
    const svg = sanitizeSvgResponse(`\`\`\`svg\n<svg viewBox="0 0 100 100" onclick="alert(1)"><linearGradient id="sky"><stop offset="0%" stop-color="#fff" /></linearGradient><text x="10" y="20">鹈鹕 &amp; 自行车</text></svg>\n\`\`\``)
    expect(svg).toContain('<svg viewBox="0 0 100 100">')
    expect(svg).toContain('<linearGradient id="sky">')
    expect(svg).not.toContain('onclick')
  })

  it('移除合法 XML 注释后保留 SVG 图形', () => {
    const svg = sanitizeSvgResponse('<svg><!-- model note --><circle cx="5" cy="5" r="4" /></svg>')
    expect(svg).toBe('<svg><circle cx="5" cy="5" r="4" /></svg>')
  })

  it('保留受限 SVG 动画元素', () => {
    const svg = sanitizeSvgResponse('<svg><circle cx="5" cy="5" r="4"><animate attributeName="r" from="2" to="4" dur="1s" repeatCount="indefinite" /></circle></svg>')
    expect(svg).toContain('<animate attributeName="r" from="2" to="4" dur="1s" repeatCount="indefinite" />')
  })

  it('拒绝脚本、外部资源和畸形标签', () => {
    expect(() => sanitizeSvgResponse('<svg><script>alert(1)</script></svg>')).toThrow('不安全')
    expect(() => sanitizeSvgResponse('<svg><path fill="url(https://evil.example/a)" /></svg>')).not.toThrow()
    const cleaned = sanitizeSvgResponse('<svg><path fill="url(https://evil.example/a)" /></svg>')
    expect(cleaned).not.toContain('https://')
    expect(() => sanitizeSvgResponse('<svg><g></svg>')).toThrow('未正确配对')
  })

  it('按 HTTP 语义分类失败', () => {
    expect(svgEvaluationInternals.classifyFailure(429).status).toBe('retryable')
    expect(svgEvaluationInternals.classifyFailure(503).status).toBe('retryable')
    expect(svgEvaluationInternals.classifyFailure(400).status).toBe('unsupported')
    expect(svgEvaluationInternals.classifyFailure(401).status).toBe('auth_blocked')
    expect(svgEvaluationInternals.classifyFailure(null).status).toBe('retryable')
  })

  it('调用 OpenAI 兼容接口时发送固定 prompt 并读取 token 用量', async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.messages).toEqual([{ role: 'user', content: SVG_EVALUATION_PROMPT }])
      expect(body).not.toHaveProperty('max_tokens')
      expect(body.stream).toBe(false)
      return new Response(JSON.stringify({
        choices: [{ message: { content: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>' } }],
        usage: { prompt_tokens: 12, completion_tokens: 34 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch

    const result = await generateSvg(provider, 'secret', 'model-a', fetchImpl)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.promptTokens).toBe(12)
      expect(result.completionTokens).toBe(34)
    }
  })

  it('每轮公平选择且同厂商不超过两个', () => {
    const rows = [
      { id: 1, provider_id: 'a', model_id: 'a1', status: 'pending' as const },
      { id: 2, provider_id: 'a', model_id: 'a2', status: 'pending' as const },
      { id: 3, provider_id: 'a', model_id: 'a3', status: 'pending' as const },
      { id: 4, provider_id: 'b', model_id: 'b1', status: 'retryable' as const },
    ]
    const current = new Set(rows.map((row) => `${row.provider_id}\0${row.model_id}`))
    expect(svgEvaluationInternals.selectFairCandidates(rows, current).map((row) => row.id)).toEqual([1, 2, 4])
  })

  it('用受 D1 绑定参数限制的多行 INSERT 同步候选模型', () => {
    const candidates = Array.from({ length: 126 }, (_, index) => ({
      providerId: `provider-${index % 10}`,
      providerName: `Provider ${index % 10}`,
      modelId: `model-${index}`,
    }))
    const statements = svgEvaluationInternals.buildCandidateInsertStatements(candidates, '2026-09-13T12:00:00.000Z')

    expect(statements).toHaveLength(8)
    expect(statements.every((statement) => statement.params.length <= 100)).toBe(true)
    expect(statements.slice(0, 7).every((statement) => statement.params.length === 96)).toBe(true)
    expect(statements.at(-1)?.params).toHaveLength(84)
    expect(statements[0].sql).toContain('WHERE svg_evaluations.provider_name <> excluded.provider_name')
  })
})
