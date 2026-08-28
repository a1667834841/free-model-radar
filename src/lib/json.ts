export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  return JSON.parse(text)
}
