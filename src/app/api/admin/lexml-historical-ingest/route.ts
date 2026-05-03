/**
 * POST /api/admin/lexml-historical-ingest
 *
 * Indexa uma versão histórica de lei no Pinecone com metadados temporais.
 * Requer autenticação de administrador.
 *
 * Body:
 *   urn          string   URN LexML (ex: "urn:lex:br:federal:lei:2002-01-10;10406")
 *   dataVigencia string   YYYY-MM-DD — início de vigência desta redação
 *   dataRevogacao? string YYYY-MM-DD — fim de vigência ('9999-12-31' se ainda vigente)
 *   textoCompleto? string Texto completo desta redação (opcional; busca no LexML se omitido)
 *   dryRun?      boolean  true = prepara vetores mas não indexa
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/server-auth'
import { ingestLexMLHistorical } from '@/lib/providers/lexml-historical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    await requireServerAuth(req)

    const body = await req.json().catch(() => ({}))
    const { urn, dataVigencia, dataRevogacao, textoCompleto, dryRun } = body

    if (!urn || typeof urn !== 'string') {
      return NextResponse.json({ error: 'urn is required (string)' }, { status: 400 })
    }
    if (!dataVigencia || typeof dataVigencia !== 'string') {
      return NextResponse.json({ error: 'dataVigencia is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const result = await ingestLexMLHistorical({
      urn,
      dataVigencia,
      dataRevogacao: typeof dataRevogacao === 'string' ? dataRevogacao : '9999-12-31',
      textoCompleto: typeof textoCompleto === 'string' ? textoCompleto : undefined,
      dryRun: !!dryRun,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[lexml-historical-ingest]', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
