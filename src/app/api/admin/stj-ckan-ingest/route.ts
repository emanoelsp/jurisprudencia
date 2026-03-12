// POST /api/admin/stj-ckan-ingest
// Ingest automatizado: lista recursos do CKAN STJ, baixa JSON e upserta no Pinecone.
// Se a API CKAN retornar 403, use resourceUrl no body com um link direto (ex.: copiado do portal).

import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/server-auth'
import {
  getStjAcordaosResourceUrls,
  fetchResourceJson,
  parseStjResourceJson,
  type StjDocNormalized,
} from '@/lib/stj-dados-abertos'
import { chunkText, generateEmbedding } from '@/lib/rag'
import { upsertPinecone } from '@/lib/pinecone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEFAULT_MAX_DOCS = 40
const DEFAULT_MAX_RESOURCES = 2
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 1000)
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 200)

type Body = {
  resourceUrl?: string
  dryRun?: boolean
  maxDocs?: number
  maxResources?: number
  namespace?: string
}

async function requireAuthOrCron(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  const cronSecret = process.env.CRON_SECRET || process.env.STJ_CKAN_INGEST_SECRET
  if (cronSecret && token === cronSecret) return
  await requireServerAuth(req)
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthOrCron(req)

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
      return NextResponse.json(
        { error: 'Configure PINECONE_API_KEY e PINECONE_HOST.' },
        { status: 400 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const dryRun = !!body.dryRun
    const maxDocs = Math.min(Math.max(Number(body.maxDocs) || DEFAULT_MAX_DOCS, 1), 200)
    const maxResources = Math.min(Math.max(Number(body.maxResources) || DEFAULT_MAX_RESOURCES, 1), 10)
    const namespace =
      (typeof body.namespace === 'string' ? body.namespace.trim() : '') ||
      process.env.PINECONE_NAMESPACE ||
      'jurisprudencia_publica'

    let resources: Array<{ package: string; resource: string; url: string; format: string }> = []

    if (body.resourceUrl?.trim()) {
      resources = [{ package: 'manual', resource: 'url', url: body.resourceUrl.trim(), format: 'json' }]
    } else {
      const list = await getStjAcordaosResourceUrls()
      if (list.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Nenhum recurso de acórdãos encontrado. A API CKAN pode estar retornando 403. Tente enviar resourceUrl no body com um link direto para um JSON.',
          tip: 'Abra https://dadosabertos.web.stj.jus.br, baixe um dataset em JSON e use o link do recurso em resourceUrl.',
        }, { status: 502 })
      }
      resources = list.slice(0, maxResources)
    }

    const allDocs: StjDocNormalized[] = []
    for (const r of resources) {
      if (r.format?.toLowerCase() === 'zip') continue
      try {
        const data = await fetchResourceJson(r.url)
        const docs = parseStjResourceJson(data).slice(0, maxDocs)
        allDocs.push(...docs)
      } catch (err: any) {
        console.warn('[stj-ckan-ingest] fetch failed', r.url, err?.message)
      }
    }

    const chunkSize = Math.max(CHUNK_SIZE, 300)
    const overlap = Math.max(CHUNK_OVERLAP, 50)
    const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []

    for (const doc of allDocs) {
      const chunks = chunkText(doc.texto || doc.ementa, chunkSize, overlap).slice(0, 6)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await generateEmbedding(chunk)
        vectors.push({
          id: `${doc.id}-chunk-${i}`.replace(/\s+/g, '-'),
          values: embedding,
          metadata: {
            numero: doc.numero,
            tribunal: doc.tribunal,
            relator: doc.relator,
            dataJulgamento: doc.dataJulgamento,
            ementa: doc.ementa.slice(0, 1800),
            texto: chunk.slice(0, 1800),
            fonte: 'stj_dados_abertos',
            ingestedAt: new Date().toISOString(),
          },
        })
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
      dryRun,
      namespace,
      resourcesAttempted: resources.length,
      docsParsed: allDocs.length,
      vectorsPrepared: vectors.length,
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stj-ckan-ingest]', err)
    return NextResponse.json(
      { error: err?.message || 'Erro no ingest' },
      { status: 500 }
    )
  }
}
