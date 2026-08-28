import { writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const filePath = process.argv[2] ?? 'config/providers.local.json'
const result = spawnSync('npx', ['wrangler', 'kv', 'key', 'get', 'providers-config', '--binding', 'RADAR_KV', '--remote'], { encoding: 'utf8' })
if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}
await writeFile(filePath, result.stdout, 'utf8')
console.log(`Provider config written to ${filePath}`)
