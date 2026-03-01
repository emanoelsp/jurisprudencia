// Ingesta CF/88 e Código Penal no Pinecone para busca RAG
// POST /api/admin/legislacao-ingest
// Body: { dryRun?: boolean, fonte?: 'cf' | 'cp' | 'ambos' }

import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/server-auth'
import { runLegislacaoIngest } from '@/lib/run-legislacao-ingest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type IngestBody = { dryRun?: boolean; fonte?: 'cf' | 'cp' | 'ambos' }

export async function POST(req: NextRequest) {
  try {
    await requireServerAuth(req)

    const body = (await req.json()).catch(() => ({})) as IngestBody
    const dryRun = !!body?.dryRun
    const fonte = (body?.fonte || 'ambos') as 'cf' | 'cp' | 'ambos'

    const result = await runLegislacaoIngest({ dryRun, fonte })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Ingest failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      namespace: result.namespace,
      vectorsPrepared: result.vectorsPrepared,
      vectorsUpserted: result.vectorsUpserted,
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
