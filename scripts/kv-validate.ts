import { readFile } from 'node:fs/promises'
import { parseProviderConfigDocument } from '../src/domain/provider'

const filePath = process.argv[2] ?? 'config/providers.local.json'
const content = await readFile(filePath, 'utf8')
parseProviderConfigDocument(JSON.parse(content))
console.log(`Provider config is valid: ${filePath}`)
