export type RadarEnv = {
  RADAR_KV: KVNamespace
  RADAR_DB?: D1Database
  REFRESH_QUEUE?: Queue<import('./refresh').RefreshQueueMessage>
  SVG_EVALUATION_QUEUE?: Queue<import('./svg-evaluation').SvgEvaluationQueueMessage>
  REFRESH_ADMIN_TOKEN?: string
  GATEWAY_API_KEY?: string
  [key: string]: unknown
}

export function getRadarDatabase(env: RadarEnv): D1Database {
  if (!env.RADAR_DB) throw new Error('Missing RADAR_DB binding')
  return env.RADAR_DB
}

export function getSecret(env: RadarEnv, secretName: string): string {
  const value = env[secretName]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing secret: ${secretName}`)
  }
  return value
}
