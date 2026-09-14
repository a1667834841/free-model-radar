import { describe, expect, it } from 'vitest'
import { parseContextTokens, supportsAutoModelCapabilities } from '@/domain/model-capabilities'

const thinkingEvidence = {
  thinkingModeEnabled: true,
  thinkTagDetected: true,
}

describe('auto 模型能力筛选', () => {
  it('解析 K 和 M 上下文长度', () => {
    expect(parseContextTokens('1M')).toBe(1_000_000)
    expect(parseContextTokens('1.05M')).toBe(1_050_000)
    expect(parseContextTokens('256K/262K')).toBe(262_000)
    expect(parseContextTokens('未知')).toBeNull()
  })

  it('接受 1M、图片输入且有实测 think 标签的模型', () => {
    expect(supportsAutoModelCapabilities({
      id: 'qwen3.8-27b',
      providerName: 'B.AI',
      ...thinkingEvidence,
    })).toBe(true)
  })

  it('拒绝上下文不足或不支持图片输入的模型', () => {
    expect(supportsAutoModelCapabilities({
      id: 'qwen/qwen3.8-27b',
      providerName: 'Groq Cloud',
      ...thinkingEvidence,
    })).toBe(false)
    expect(supportsAutoModelCapabilities({
      id: 'deepseek-v4-flash',
      providerName: 'B.AI',
      ...thinkingEvidence,
    })).toBe(false)
  })

  it('拒绝没有开启思考模式或没有 think 标签的模型', () => {
    expect(supportsAutoModelCapabilities({
      id: 'qwen3.8-27b',
      providerName: 'B.AI',
      thinkingModeEnabled: false,
      thinkTagDetected: true,
    })).toBe(false)
    expect(supportsAutoModelCapabilities({
      id: 'qwen3.8-27b',
      providerName: 'B.AI',
      thinkingModeEnabled: true,
      thinkTagDetected: false,
    })).toBe(false)
  })
})
