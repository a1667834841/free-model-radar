import { readFile } from 'node:fs/promises'
import { parseProviderConfigDocument } from '../src/domain/provider'
import { spawnSync } from 'node:child_process'

const filePath = process.argv[2] ?? 'config/providers.local.json'
const content = await readFile(filePath, 'utf8')
const config = parseProviderConfigDocument(JSON.parse(content))
const minified = JSON.stringify(config)
const result = spawnSync('npx', ['wrangler', 'kv', 'key', 'put', 'providers-config', minified, '--binding', 'RADAR_KV', '--remote'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
