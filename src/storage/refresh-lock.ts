import type { RefreshLock } from '@/domain/refresh'
import { KV_KEYS } from './kv-keys'

const LOCK_GET_ATTEMPTS = 3
const LOCK_GET_RETRY_DELAY_MS = 150

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getCurrentLock(kv: KVNamespace): Promise<string | null> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < LOCK_GET_ATTEMPTS; attempt += 1) {
    try {
      return await kv.get(KV_KEYS.refreshLock)
    } catch (error) {
      lastError = error
      if (attempt < LOCK_GET_ATTEMPTS - 1) {
        await sleep(LOCK_GET_RETRY_DELAY_MS)
      }
    }
  }
  throw lastError
}

export async function acquireRefreshLock(kv: KVNamespace, refreshId: string, now = new Date(), ttlSeconds = 600): Promise<boolean> {
  const startedAt = Date.now()
  const current = await getCurrentLock(kv)
  if (current) {
    const lock = JSON.parse(current) as RefreshLock
    if (new Date(lock.expiresAt).getTime() > now.getTime()) {
      console.log(`[lock] acquire(${refreshId}) FAILED: held by ${lock.refreshId} until ${lock.expiresAt} (get took ${Date.now() - startedAt}ms)`)
      return false
    }
  }

  const lock: RefreshLock = {
    refreshId,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  }
  await kv.put(KV_KEYS.refreshLock, JSON.stringify(lock), { expirationTtl: ttlSeconds })
  console.log(`[lock] acquire(${refreshId}) OK (took ${Date.now() - startedAt}ms)`)
  return true
}

export async function releaseRefreshLock(kv: KVNamespace): Promise<void> {
  const startedAt = Date.now()
  await kv.delete(KV_KEYS.refreshLock)
  console.log(`[lock] release took ${Date.now() - startedAt}ms`)
}
