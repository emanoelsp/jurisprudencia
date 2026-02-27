import { Pinecone } from '@pinecone-database/pinecone'
import type { RecordMetadata, RecordMetadataValue } from '@pinecone-database/pinecone'

export interface PineconeVector {
  id: string
  values: number[]
  metadata?: Record<string, unknown>
}

function getPineconeConfig() {
  const host = process.env.PINECONE_HOST?.replace(/\/$/, '')
  const indexName = process.env.PINECONE_INDEX
  const apiKey = process.env.PINECONE_API_KEY
  const namespace = process.env.PINECONE_NAMESPACE
  if (!host || !apiKey) return null
  return { host, apiKey, namespace, indexName }
}

function getPineconeIndex(namespaceOverride?: string) {
  const cfg = getPineconeConfig()
  if (!cfg) return null

  const pc = new Pinecone({ apiKey: cfg.apiKey })
  const namespace = namespaceOverride || cfg.namespace
  const index = cfg.host
    ? pc.index({ host: cfg.host, ...(namespace ? { namespace } : {}) })
    : cfg.indexName
      ? pc.index({ name: cfg.indexName, ...(namespace ? { namespace } : {}) })
      : null

  return index
}

export async function queryPinecone(
  vector: number[],
  topK: number,
  filter?: Record<string, unknown>,
  namespaceOverride?: string
) {
  const index = getPineconeIndex(namespaceOverride)
  if (!index) return null

  return index.query({
    topK,
    vector,
    includeMetadata: true,
    includeValues: false,
    ...(filter ? { filter } : {}),
  })
}

export async function upsertPinecone(vectors: PineconeVector[], namespaceOverride?: string) {
  if (vectors.length === 0) return { upsertedCount: 0 }
  const index = getPineconeIndex(namespaceOverride)
  if (!index) throw new Error('Pinecone config missing. Set PINECONE_HOST and PINECONE_API_KEY.')

  await index.upsert({
    records: vectors.map(v => ({
      id: v.id,
      values: v.values,
      metadata: toRecordMetadata(v.metadata),
    })),
  })

  return { upsertedCount: vectors.length }
}

function toRecordMetadata(input?: Record<string, unknown>): RecordMetadata | undefined {
  if (!input) return undefined
  const out: RecordMetadata = {}
  for (const [key, value] of Object.entries(input)) {
    const casted = toMetadataValue(value)
    if (casted !== undefined) out[key] = casted
  }
  return out
}

function toMetadataValue(value: unknown): RecordMetadataValue | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    const allStrings = value.every(item => typeof item === 'string')
    if (allStrings) return value as string[]
    return undefined
  }
  return String(value)
}
