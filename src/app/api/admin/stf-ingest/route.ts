/**
 * POST /api/admin/stf-ingest
 *
 * Ingestão manual de acórdãos do STF via DataJud CNJ.
 * Autenticação: Firebase ou CRON_SECRET.
 *
 * Body (opcional):
 *   maxDocs?   number   — quantos acórdãos baixar (default: 40, máx: 100)
 *   dateFrom?  string   — YYYY-MM-DD (default: 30 dias atrás)
 *   dateTo?    string   — YYYY-MM-DD (default: hoje)
 *   dryRun?    boolean  — apenas prepara vetores, sem upsert
 *   namespace? string   — Pinecone namespace (default: jurisprudencia_publica)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/auth/server-auth'
import { ingestStfDecisions } from '@/lib/providers/stf-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function requireAuthOrCron(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && token === cronSecret) return
  await requireServerAuth(req)
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthOrCron(req)

    const body = await req.json().catch(() => ({}))
    const maxDocs = Math.min(Math.max(Number(body.maxDocs) || 40, 1), 100)

    const result = await ingestStfDecisions({
      maxDocs,
      dateFrom: typeof body.dateFrom === 'string' ? body.dateFrom : undefined,
      dateTo: typeof body.dateTo === 'string' ? body.dateTo : undefined,
      namespace: typeof body.namespace === 'string' ? body.namespace : undefined,
      dryRun: !!body.dryRun,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error, ...result }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stf-ingest]', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
