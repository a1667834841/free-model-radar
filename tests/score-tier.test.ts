import { describe, expect, it } from 'vitest'
import { getScoreTierVar, scoreTierOf } from '../src/lib/score-tier'

describe('score tiers', () => {
  it('maps normalized composite scores to high, mid, and low colors', () => {
    expect(scoreTierOf(85).label).toBe('high')
    expect(scoreTierOf(84.9).label).toBe('mid')
    expect(scoreTierOf(70).label).toBe('mid')
    expect(scoreTierOf(69.9).label).toBe('low')
  })

  it('uses a neutral track color when score is unavailable', () => {
    expect(getScoreTierVar(null)).toBe('var(--track)')
  })
})
