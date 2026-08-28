export type RadarEnv = {
  RADAR_KV: KVNamespace
  REFRESH_ADMIN_TOKEN?: string
  [key: string]: unknown
}

export function getSecret(env: RadarEnv, secretName: string): string {
  const value = env[secretName]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing secret: ${secretName}`)
  }
  return value
}