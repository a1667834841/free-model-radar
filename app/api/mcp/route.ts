import { getLatestResults } from '@/storage/results-store'
import { getRadarEnv } from '@/lib/cloudflare'

const MCP_PROTOCOL_VERSION = '2025-11-25'
const MCP_ENDPOINT = 'https://fm.ggball.top/api/mcp'
const RESULTS_ENDPOINT = 'https://fm.ggball.top/api/results'

type JsonRpcRequest = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

function headers(contentType = 'application/json'): Headers {
  return new Headers({
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id',
    'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    'cache-control': 'no-store',
  })
}

function jsonRpc(id: JsonRpcRequest['id'], result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }), { status, headers: headers() })
}

function jsonRpcError(id: JsonRpcRequest['id'], code: number, message: string, status = 200): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }), { status, headers: headers() })
}

function toolList() {
  return {
    tools: [
      {
        name: 'get_radar_results',
        description: '读取 Free Model Radar 最新公开模型测评数据。',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
    ],
  }
}

async function callTool(name: string) {
  if (name === 'get_radar_results') {
    const env = await getRadarEnv()
    const results = await getLatestResults(env.RADAR_KV)
    return results ?? { updatedAt: null, isStale: true, providers: [] }
  }
  throw new Error(`Unknown tool: ${name}`)
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: headers() })
}

export async function GET() {
  return new Response(JSON.stringify({ name: 'free-model-radar', endpoint: MCP_ENDPOINT, results: RESULTS_ENDPOINT, protocolVersion: MCP_PROTOCOL_VERSION, transport: 'streamable-http', public: true }), { headers: headers() })
}

export async function POST(request: Request) {
  let message: JsonRpcRequest
  try {
    message = await request.json() as JsonRpcRequest
  } catch {
    return jsonRpcError(null, -32700, 'Invalid JSON')
  }

  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return jsonRpcError(message.id, -32600, 'Invalid JSON-RPC request')
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202, headers: headers() })
  if (message.method === 'initialize') {
    return jsonRpc(message.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'free-model-radar', version: '1.0.0' },
      instructions: '公开只读模型测评 MCP；不需要 API Key。',
    })
  }
  if (message.method === 'tools/list') return jsonRpc(message.id, toolList())
  if (message.method === 'tools/call') {
    const name = message.params?.name
    if (typeof name !== 'string') return jsonRpcError(message.id, -32602, 'Missing tool name')
    try {
      const result = await callTool(name)
      return jsonRpc(message.id, { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result })
    } catch (error) {
      return jsonRpc(message.id, { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true })
    }
  }
  return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`)
}
