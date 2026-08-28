import { z } from 'zod'

export const providerConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  baseUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'baseUrl must use https'),
  secretName: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  enabled: z.boolean().default(true),
  modelStrategy: z.enum(['free-first']),
  freeKeywords: z.array(z.string().min(1)).min(1),
  probe: z.object({
    maxModels: z.number().int().positive().max(500),
    concurrency: z.number().int().positive().max(50),
    attempts: z.number().int().positive().max(10),
    timeoutMs: z.number().int().positive().max(120_000),
  }),
})

export const providerConfigDocumentSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  providers: z.array(providerConfigSchema),
}).superRefine((document, ctx) => {
  const ids = new Set<string>()
  for (const provider of document.providers) {
    if (ids.has(provider.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate provider id: ${provider.id}`,
        path: ['providers'],
      })
    }
    ids.add(provider.id)
  }
})

export type ProviderConfig = z.infer<typeof providerConfigSchema>
export type ProviderConfigDocument = z.infer<typeof providerConfigDocumentSchema>

export function parseProviderConfigDocument(input: unknown): ProviderConfigDocument {
  return providerConfigDocumentSchema.parse(input)
}
