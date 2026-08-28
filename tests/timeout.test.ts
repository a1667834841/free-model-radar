import { describe, expect, it } from 'vitest'
import { withTimeout } from '@/lib/timeout'

describe('withTimeout', () => {
  it('rejects at the timeout even if the operation never settles', async () => {
    const startedAt = Date.now()

    await expect(withTimeout(
      () => new Promise<never>(() => undefined),
      25,
    )).rejects.toThrow('Operation timed out after 25ms')

    expect(Date.now() - startedAt).toBeLessThan(200)
  })
})
