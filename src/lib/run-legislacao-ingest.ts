// Lógica compartilhada de ingestão CF/88 e Código Penal no Pinecone
// Usada por /api/admin/legislacao-ingest e /api/setup/seed-legislacao

import { chunkText, generateEmbedding } from '@/lib/rag'
import { upsertPinecone } from '@/lib/pinecone'
import { ARTIGOS_CONSTITUCIONAIS } from '@/lib/artigos-constitucionais'
import { ARTIGOS_PENAIS, fetchCodigoPenalPlanalto } from '@/lib/codigo-penal'
import { fetchCfPlanalto } from '@/lib/cf-planalto'
import type { PineconeVector } from '@/lib/pinecone'

export type LegislaçãoFonte = 'cf' | 'cp' | 'ambos'

export interface RunLegislacaoIngestResult {
  success: boolean
  namespace: string
  vectorsPrepared: number
  vectorsUpserted: number
  dryRun: boolean
  fonte: LegislaçãoFonte
  error?: string
}

export async function runLegislacaoIngest(
  options: { dryRun?: boolean; fonte?: LegislaçãoFonte } = {}
): Promise<RunLegislacaoIngestResult> {
  const dryRun = !!options.dryRun
  const fonte = (options.fonte || 'ambos') as LegislaçãoFonte

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
    return {
      success: false,
      namespace: '',
      vectorsPrepared: 0,
      vectorsUpserted: 0,
      dryRun,
      fonte,
      error: 'Missing Pinecone config (PINECONE_API_KEY, PINECONE_HOST).',
    }
  }

  const namespace =
    process.env.PINECONE_LEGISLACAO_NAMESPACE?.trim() ||
    process.env.PINECONE_NAMESPACE?.trim() ||
    'legislacao'
  const chunkSize = Math.max(Number(process.env.RAG_CHUNK_SIZE || 1000), 300)
  const overlap = Math.max(Number(process.env.RAG_CHUNK_OVERLAP || 200), 50)

  const vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }> = []

  try {
    if (fonte === 'cf' || fonte === 'ambos') {
      let arts = await fetchCfPlanalto()
      if (arts.length < 5) {
        arts = [...arts, ...ARTIGOS_CONSTITUCIONAIS.map(a => ({ id: a.id, titulo: a.titulo, texto: a.texto }))]
      }
      console.log('[legislacao-ingest] CF/88: fetched', arts.length, 'articles from Planalto')
      for (const a of arts) {
        const texto = `[${a.titulo}]\n${a.texto}`
        const chunks = chunkText(texto, chunkSize, overlap).slice(0, 3)
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i])
          vectors.push({
            id: `cf-${a.id.replace(/\s+/g, '-')}-${i}`,
            values: embedding,
            metadata: {
              numero: a.titulo,
              titulo: a.titulo,
              ementa: a.texto.slice(0, 1800),
              texto: chunks[i].slice(0, 1800),
              tribunal: '',
              relator: '',
              dataJulgamento: '',
              fonte: 'cf_88',
              ingestedAt: new Date().toISOString(),
            },
          })
        }
      }
    }

    if (fonte === 'cp' || fonte === 'ambos') {
      let cpArts = await fetchCodigoPenalPlanalto()
      if (cpArts.length < 5) cpArts = ARTIGOS_PENAIS
      console.log('[legislacao-ingest] CP: fetched', cpArts.length, 'articles from Planalto')
      for (const a of cpArts) {
        const texto = `[${a.titulo}]\n${a.texto}`
        const chunks = chunkText(texto, chunkSize, overlap).slice(0, 3)
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i])
          vectors.push({
            id: `cp-${a.id}-${i}`,
            values: embedding,
            metadata: {
              numero: a.titulo,
              titulo: a.titulo,
              ementa: a.texto.slice(0, 1800),
              texto: chunks[i].slice(0, 1800),
              tribunal: '',
              relator: '',
              dataJulgamento: '',
              fonte: 'codigo_penal',
              ingestedAt: new Date().toISOString(),
            },
          })
        }
      }
    }

    let vectorsUpserted = 0
    if (!dryRun && vectors.length > 0) {
      const batchSize = 50
      for (let i = 0; i < vectors.length; i += batchSize) {
        await upsertPinecone(vectors.slice(i, i + batchSize), namespace)
        vectorsUpserted += Math.min(batchSize, vectors.length - i)
      }
    }

    return {
      success: true,
      namespace,
      vectorsPrepared: vectors.length,
      vectorsUpserted,
      dryRun,
      fonte,
    }
  } catch (err: any) {
    console.error('[run-legislacao-ingest]', err)
    return {
      success: false,
      namespace,
      vectorsPrepared: vectors.length,
      vectorsUpserted: 0,
      dryRun,
      fonte,
      error: err?.message || 'Unknown error',
    }
  }
}
