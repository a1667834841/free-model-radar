import { describe, expect, it } from 'vitest'
import { AGENT_OPTIONS, makeAgentConfigContext } from '@/domain/agent-config'

const ctx = makeAgentConfigContext({
  providerId: 'openrouter',
  providerName: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  secretName: 'OPENROUTER_API_KEY',
  modelId: 'deepseek-r1:free',
})

describe('agent config generation', () => {
  it('covers all documented agents', () => {
    const ids = AGENT_OPTIONS.map((option) => option.id)
    expect(ids).toEqual(['claude-code', 'codex', 'opencode', 'gemini-cli', 'zed', 'cursor'])
  })

  it('embeds modelId and a compatibility note into every config', () => {
    for (const option of AGENT_OPTIONS) {
      const content = option.generate(ctx, option)
      expect(content).toContain(ctx.modelId)
      expect(option.compatibility.length).toBeGreaterThan(0)
    }
  })

  it('embeds baseUrl into configs that accept an endpoint', () => {
    for (const id of ['claude-code', 'codex', 'opencode', 'gemini-cli', 'cursor']) {
      const option = AGENT_OPTIONS.find((o) => o.id === id)!
      const content = option.generate(ctx, option)
      expect(content).toContain(ctx.baseUrl)
    }
  })

  it('uses the secret env name in codex and opencode configs', () => {
    const codex = AGENT_OPTIONS.find((o) => o.id === 'codex')!
    const opencode = AGENT_OPTIONS.find((o) => o.id === 'opencode')!

    const codexContent = codex.generate(ctx, codex)
    const opencodeContent = opencode.generate(ctx, opencode)

    expect(codexContent).toContain('env_key = "OPENROUTER_API_KEY"')
    expect(codexContent).toContain('wire_api = "responses"')
    expect(opencodeContent).toContain('"apiKey": "{env:OPENROUTER_API_KEY}"')
    expect(opencodeContent).toContain('"model": "openrouter/deepseek-r1:free"')
  })

  it('marks the anthropic endpoint for claude code', () => {
    const claude = AGENT_OPTIONS.find((o) => o.id === 'claude-code')!
    const content = claude.generate(ctx, claude)
    expect(content).toContain('ANTHROPIC_BASE_URL')
    expect(content).toContain('"ANTHROPIC_MODEL": "deepseek-r1:free"')
  })

  it('falls back secret name when missing', () => {
    const fallback = makeAgentConfigContext({
      providerId: 'a',
      providerName: 'A',
      modelId: 'm',
    })
    expect(fallback.secretName).toBe('OPENAI_API_KEY')
    expect(fallback.baseUrl).toBe('<baseUrl>')
  })

  describe('multi-model coverage', () => {
    const multiCtx = makeAgentConfigContext({
      providerId: 'openrouter',
      providerName: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      secretName: 'OPENROUTER_API_KEY',
      modelId: 'deepseek-r1:free',
      modelIds: ['deepseek-r1:free', 'llama-3.3-70b:free', 'qwen3:free'],
    })

    it('embeds all free model ids into opencode models map', () => {
      const opencode = AGENT_OPTIONS.find((o) => o.id === 'opencode')!
      const content = opencode.generate(multiCtx, opencode)
      for (const id of multiCtx.modelIds) {
        expect(content).toContain(`"${id}": { "name": "${id}" }`)
      }
    })

    it('caps claude code to at most 3 model slots', () => {
      const claude = AGENT_OPTIONS.find((o) => o.id === 'claude-code')!
      const content = claude.generate(multiCtx, claude)
      expect(content).toContain('"ANTHROPIC_MODEL": "deepseek-r1:free"')
      expect(content).toContain('"ANTHROPIC_DEFAULT_MODEL": "llama-3.3-70b:free"')
      expect(content).toContain('"model": "qwen3:free"')

      const extraCtx = makeAgentConfigContext({
        providerId: 'openrouter',
        providerName: 'OpenRouter',
        modelId: 'a',
        modelIds: ['a', 'b', 'c', 'd'],
      })
      const capped = claude.generate(extraCtx, claude)
      expect(capped).toContain('"model": "c"')
      expect(capped).not.toContain('"model": "d"')
    })

    it('fills zed model slots with as many free models as available', () => {
      const zed = AGENT_OPTIONS.find((o) => o.id === 'zed')!
      const zedCtx = makeAgentConfigContext({
        providerId: 'openrouter',
        providerName: 'OpenRouter',
        modelId: 'm1',
        modelIds: ['m1', 'm2', 'm3', 'm4', 'm5'],
      })
      const content = zed.generate(zedCtx, zed)
      expect(content).toContain('"default_model"')
      expect(content).toContain('"inline_assistant_model"')
      expect(content).toContain('"commit_message_model"')
      expect(content).toContain('"thread_summary_model"')
      expect(content).toContain('"subagent_model"')
    })
  })
})
