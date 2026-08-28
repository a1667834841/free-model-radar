import { describe, expect, it } from 'vitest'
import { getRefreshStatusOrTransient } from '@/storage/results-store'

class FailingGetKV {
  calls = 0

  async get() {
    this.calls += 1
    throw new Error('KV GET failed: 500 Internal Server Error')
  }
}

class EventuallySuccessfulGetKV {
  calls = 0

  async get() {
    this.calls += 1
    if (this.calls < 3) {
      throw new Error('KV GET failed: 500 Internal Server Error')
    }
    return JSON.stringify({
      status: 'success',
      refreshId: 'refresh-test',
      startedAt: '2026-08-27T09:00:00.000Z',
      finishedAt: '2026-08-27T09:01:00.000Z',
      error: null,
      configVersion: 1,
      progress: { completed: 1, total: 1 },
    })
  }
}

describe('results store', () => {
  it('retries refresh status KV get before returning a status', async () => {
    const kv = new EventuallySuccessfulGetKV()
    const status = await getRefreshStatusOrTransient(kv as unknown as KVNamespace)

    expect(kv.calls).toBe(3)
    expect(status.status).toBe('success')
    expect(status.transientError).toBeUndefined()
  })

  it('returns a transient running status when refresh status KV get keeps failing', async () => {
    const kv = new FailingGetKV()
    const status = await getRefreshStatusOrTransient(kv as unknown as KVNamespace)

    expect(kv.calls).toBe(3)
    expect(status.status).toBe('running')
    expect(status.transientError).toContain('KV GET failed: 500 Internal Server Error')
  })
})
