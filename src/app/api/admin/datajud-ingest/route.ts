import { NextRequest, NextResponse } from 'next/server'
import { fetchDataJudProcessos, siglaToDataJudAlias } from '@/lib/datajud'
import { chunkText, generateEmbedding } from '@/lib/rag'
import { upsertPinecone } from '@/lib/pinecone'
import { namespaceForUser } from '@/lib/tenant'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type IngestBody = {
  tribunalAlias?: string
  tribunalSigla?: string
  size?: number
  dateFrom?: string
  dateTo?: string
  dryRun?: boolean
  namespace?: string
  userId?: string
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const apiKey = process.env.DATAJUD_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing DATAJUD_API_KEY.' }, { status: 400 })
    }

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
      return NextResponse.json({ error: 'Missing Pinecone config (PINECONE_API_KEY/PINECONE_HOST).' }, { status: 400 })
    }

    const body = (await req.json()) as IngestBody
    const explicitAlias = body?.tribunalAlias?.trim()
    const sigla = body?.tribunalSigla?.trim().toUpperCase()
    const tribunalAlias = explicitAlias || (sigla ? siglaToDataJudAlias(sigla) : undefined)
    if (!tribunalAlias) {
      return NextResponse.json({
        error: 'tribunalAlias ou tribunalSigla é obrigatório (ex: tribunalSigla: "TJSP").',
      }, { status: 400 })
    }

    const size = Math.min(Math.max(Number(body.size || 20), 1), 100)
    const dryRun = !!body.dryRun
    const explicitNamespace = typeof body.namespace === 'string' ? body.namespace.trim() : ''
    const derivedNamespace = namespaceForUser(body.userId || authUser.uid)
    const namespace = explicitNamespace || derivedNamespace || process.env.PINECONE_NAMESPACE || undefined
    const requestDelayMs = Math.max(Number(process.env.DATAJUD_REQUEST_DELAY_MS || 120), 0)
    const chunkSize = Math.max(Number(process.env.RAG_CHUNK_SIZE || 1000), 300)
    const overlap = Math.max(Number(process.env.RAG_CHUNK_OVERLAP || 200), 50)

    const docs = await fetchDataJudProcessos({
      tribunalAlias,
      apiKey,
      size,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    })

    const vectors: Array<{
      id: string
      values: number[]
      metadata: Record<string, unknown>
    }> = []

    for (const doc of docs) {
      const chunks = chunkText(doc.texto, chunkSize, overlap).slice(0, 8)
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i]
        const embedding = await generateEmbedding(chunk)
        vectors.push({
          id: `${doc.numero}::${i}`.replace(/\s+/g, ''),
          values: embedding,
          metadata: {
            numero: doc.numero,
            tribunal: doc.tribunal,
            relator: doc.relator,
            dataJulgamento: doc.dataJulgamento,
            ementa: doc.ementa.slice(0, 1800),
            texto: chunk.slice(0, 1800),
            classe: doc.classe || '',
            orgaoJulgador: doc.orgaoJulgador || '',
            fonte: 'datajud_cnj',
            tribunalAlias,
            ingestedAt: new Date().toISOString(),
          },
        })
      }
      if (requestDelayMs > 0) await sleep(requestDelayMs)
    }

    if (!dryRun) {
      const batchSize = 50
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)
        await upsertPinecone(batch, namespace)
      }
    }

    return NextResponse.json({
      success: true,
      tribunalAlias,
      namespace: namespace || 'default',
      docsFetched: docs.length,
      vectorsPrepared: vectors.length,
      dryRun,
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[datajud-ingest]', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
