const COOKIE_NAME = 'radar_admin_session'
const MAX_AGE_SECONDS = 12 * 60 * 60

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sign(token: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return bytesToHex(signature)
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

export async function createAdminSessionCookie(adminToken: string, options: { secure: boolean } = { secure: true }): Promise<string> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = String(expiresAt)
  const signature = await sign(adminToken, payload)
  const secure = options.secure ? '; Secure' : ''
  return `${COOKIE_NAME}=${payload}.${signature}; Max-Age=${MAX_AGE_SECONDS}; Path=/; HttpOnly${secure}; SameSite=Strict`
}

export async function isAdminSessionCookie(cookieHeader: string | null, adminToken: string | undefined): Promise<boolean> {
  if (!adminToken) return false
  const cookies = Object.fromEntries((cookieHeader ?? '').split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=')
    return [name, rest.join('=')]
  }).filter(([name]) => name))
  const session = cookies[COOKIE_NAME]
  if (typeof session !== 'string') return false
  const [expiresAtText, signature] = session.split('.')
  const expiresAt = Number(expiresAtText)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || typeof signature !== 'string') return false
  return safeEqual(signature, await sign(adminToken, expiresAtText))
}

export function isValidAdminToken(candidate: string | null, adminToken: string | undefined): boolean {
  return typeof candidate === 'string' && typeof adminToken === 'string' && safeEqual(candidate, adminToken)
}
