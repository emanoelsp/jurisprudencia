// Ingesta CF/88 e Código Penal no Pinecone para busca RAG
// POST /api/admin/legislacao-ingest
// Body: { dryRun?: boolean, fonte?: 'cf' | 'cp' | 'ambos' }

import { NextRequest, NextResponse } from 'next/server'
import { chunkText, generateEmbedding } from '@/lib/rag'
import { upsertPinecone } from '@/lib/pinecone'
import { requireServerAuth } from '@/lib/server-auth'
import { ARTIGOS_CONSTITUCIONAIS } from '@/lib/artigos-constitucionais'
import { ARTIGOS_PENAIS } from '@/lib/codigo-penal'
import { fetchCfPlanalto } from '@/lib/cf-planalto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type IngestBody = { dryRun?: boolean; fonte?: 'cf' | 'cp' | 'ambos' }

export async function POST(req: NextRequest) {
  try {
    await requireServerAuth(req)

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
      return NextResponse.json({ error: 'Missing Pinecone config.' }, { status: 400 })
    }

    const body = (await req.json()).catch(() => ({})) as IngestBody
    const dryRun = !!body?.dryRun
    const fonte = (body?.fonte || 'ambos') as 'cf' | 'cp' | 'ambos'
    const namespace = process.env.PINECONE_LEGISLACAO_NAMESPACE?.trim() || process.env.PINECONE_NAMESPACE?.trim() || 'legislacao'
    const chunkSize = Math.max(Number(process.env.RAG_CHUNK_SIZE || 1000), 300)
    const overlap = Math.max(Number(process.env.RAG_CHUNK_OVERLAP || 200), 50)

    const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []

    if (fonte === 'cf' || fonte === 'ambos') {
      let arts = await fetchCfPlanalto()
      if (arts.length < 5) {
        arts = [...arts, ...ARTIGOS_CONSTITUCIONAIS.map(a => ({ id: a.id, titulo: a.titulo, texto: a.texto }))]
      }
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
      for (const a of ARTIGOS_PENAIS) {
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

    if (!dryRun && vectors.length > 0) {
      const batchSize = 50
      for (let i = 0; i < vectors.length; i += batchSize) {
        await upsertPinecone(vectors.slice(i, i + batchSize), namespace)
      }
    }

    return NextResponse.json({
      success: true,
      namespace,
      vectorsPrepared: vectors.length,
      dryRun,
      fonte,
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[legislacao-ingest]', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
