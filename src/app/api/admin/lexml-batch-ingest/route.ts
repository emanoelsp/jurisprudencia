/**
 * POST /api/admin/lexml-batch-ingest
 *
 * Indexa as 10 leis curadas da Camada 3 no Pinecone em sequência.
 * Idempotente: re-run sobrescreve os vetores existentes com o mesmo ID.
 *
 * Body (opcional):
 *   dryRun?  boolean — prepara vetores mas não indexa
 *   only?    string[] — array de URNs para ingerir (default: todas)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/auth/server-auth'
import { ingestLexMLHistorical } from '@/lib/providers/lexml-historical'
import { LEIS_CURADAS } from '@/lib/legal/lexml-curacao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    await requireServerAuth(req)

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_HOST) {
      return NextResponse.json(
        { error: 'Configure PINECONE_API_KEY e PINECONE_HOST.' },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = !!body.dryRun
    const only: string[] | undefined =
      Array.isArray(body.only) && body.only.length > 0 ? body.only : undefined

    const leis = only
      ? LEIS_CURADAS.filter(l => only.includes(l.urn))
      : LEIS_CURADAS

    const results = []
    let totalVectors = 0
    let errors = 0

    for (const lei of leis) {
      const result = await ingestLexMLHistorical({
        urn: lei.urn,
        dataVigencia: lei.dataVigencia,
        dataRevogacao: lei.dataRevogacao,
        textoCompleto: lei.texto,
        dryRun,
      })

      results.push({ nome: lei.nome, ...result })

      if (result.success) {
        totalVectors += result.vectorsUpserted
      } else {
        errors += 1
        console.warn('[lexml-batch-ingest] failed', { lei: lei.nome, error: result.error })
      }
    }

    return NextResponse.json({
      success: errors === 0,
      dryRun,
      total: leis.length,
      errors,
      totalVectors,
      results,
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[lexml-batch-ingest]', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
