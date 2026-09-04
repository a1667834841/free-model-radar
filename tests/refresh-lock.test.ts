import { describe, expect, it } from 'vitest'
import { acquireRefreshLock, releaseRefreshLock } from '@/storage/refresh-lock'

class MemoryKV {
  store = new Map<string, string>()

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async put(key: string, value: string) {
    this.store.set(key, value)
  }

  async delete(key: string) {
    this.store.delete(key)
  }
}

describe('refresh lock', () => {
  it('does not release a lock now owned by another operation', async () => {
    const kv = new MemoryKV()
    const namespace = kv as unknown as KVNamespace

    expect(await acquireRefreshLock(namespace, 'old-owner', new Date('2026-09-05T00:00:00.000Z'), 1)).toBe(true)
    expect(await acquireRefreshLock(namespace, 'new-owner', new Date('2026-09-05T00:00:02.000Z'), 600)).toBe(true)

    await releaseRefreshLock(namespace, 'old-owner')
    expect(JSON.parse((await kv.get('refresh-lock')) ?? '{}').refreshId).toBe('new-owner')

    await releaseRefreshLock(namespace, 'new-owner')
    expect(await kv.get('refresh-lock')).toBeNull()
  })
})
