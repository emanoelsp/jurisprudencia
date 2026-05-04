/**
 * STF Provider — ingestão offline de acórdãos do STF via DataJud CNJ.
 *
 * Padrão idêntico ao STJ CKAN: busca decisões recentes, chunka, gera embeddings
 * e upserta no Pinecone (namespace jurisprudencia_publica).
 */

import { fetchDataJudProcessos } from '@/lib/datajud'
import { chunkText, generateEmbedding } from '@/lib/rag'
import { upsertPinecone } from '@/lib/pinecone'

const STF_ALIAS = 'api_publica_stf'
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 1000)
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 200)

export interface StfIngestOptions {
  /** Quantos acórdãos baixar (máx. 100 por chamada) */
  maxDocs?: number
  /** Buscar apenas processos a partir desta data (YYYY-MM-DD) */
  dateFrom?: string
  /** Buscar apenas processos até esta data (YYYY-MM-DD) */
  dateTo?: string
  /** Namespace Pinecone (default: jurisprudencia_publica) */
  namespace?: string
  /** Apenas prepara vetores sem upsert */
  dryRun?: boolean
}

export interface StfIngestResult {
  success: boolean
  docsFetched: number
  docsParsed: number
  vectorsPrepared: number
  vectorsUpserted: number
  dryRun: boolean
  durationMs: number
  error?: string
}

export async function ingestStfDecisions(
  options: StfIngestOptions = {}
): Promise<StfIngestResult> {
  const t0 = Date.now()
  const {
    maxDocs = 40,
    dryRun = false,
  } = options

  const namespace =
    options.namespace ||
    process.env.PINECONE_NAMESPACE ||
    'jurisprudencia_publica'

  const apiKey = process.env.DATAJUD_API_KEY || process.env.DATAJUD_KEY || ''

  if (!apiKey) {
    return {
      success: false, docsFetched: 0, docsParsed: 0,
      vectorsPrepared: 0, vectorsUpserted: 0, dryRun,
      durationMs: Date.now() - t0,
      error: 'DATAJUD_API_KEY não configurado.',
    }
  }

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
    return {
      success: false, docsFetched: 0, docsParsed: 0,
      vectorsPrepared: 0, vectorsUpserted: 0, dryRun,
      durationMs: Date.now() - t0,
      error: 'Pinecone config missing.',
    }
  }

  // Calcula janela de datas: por padrão os últimos 30 dias
  const today = new Date()
  const dateTo = options.dateTo || today.toISOString().slice(0, 10)
  const dateFrom = options.dateFrom || (() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })()

  let docs
  try {
    docs = await fetchDataJudProcessos({
      tribunalAlias: STF_ALIAS,
      apiKey,
      size: Math.min(maxDocs, 100),
      dateFrom,
      dateTo,
    })
  } catch (err: any) {
    return {
      success: false, docsFetched: 0, docsParsed: 0,
      vectorsPrepared: 0, vectorsUpserted: 0, dryRun,
      durationMs: Date.now() - t0,
      error: `DataJud STF fetch failed: ${err.message}`,
    }
  }

  const docsFetched = docs.length
  const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
  let docsParsed = 0

  for (const doc of docs) {
    const text = [doc.ementa, doc.texto].filter(Boolean).join('\n').trim()
    if (text.length < 30) continue

    docsParsed += 1
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP).slice(0, 8)

    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i])
        const safeNumero = (doc.numero || doc.id || '').replace(/[^a-z0-9.\-]/gi, '-').slice(0, 80)
        vectors.push({
          id: `stf:${safeNumero}:${i}`,
          values: embedding,
          metadata: {
            numero: doc.numero,
            ementa: chunks[i].slice(0, 1800),
            tribunal: 'STF',
            relator: doc.relator || '',
            dataJulgamento: doc.dataJulgamento || dateTo,
            fonte: 'datajud_cnj',
            classe: doc.classe || '',
            orgaoJulgador: doc.orgaoJulgador || '',
            ingestedAt: new Date().toISOString(),
          },
        })
      } catch (err) {
        console.warn('[stf-provider] embedding failed', { doc: doc.numero, chunk: i, err })
      }
    }
  }

  let vectorsUpserted = 0
  if (!dryRun && vectors.length > 0) {
    try {
      await upsertPinecone(vectors, namespace)
      vectorsUpserted = vectors.length
    } catch (err: any) {
      return {
        success: false, docsFetched, docsParsed,
        vectorsPrepared: vectors.length, vectorsUpserted: 0, dryRun,
        durationMs: Date.now() - t0,
        error: `Pinecone upsert failed: ${err.message}`,
      }
    }
  }

  return {
    success: true, docsFetched, docsParsed,
    vectorsPrepared: vectors.length,
    vectorsUpserted: dryRun ? 0 : vectorsUpserted,
    dryRun,
    durationMs: Date.now() - t0,
  }
}
