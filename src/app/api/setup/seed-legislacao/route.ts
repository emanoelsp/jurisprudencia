// Seed CF/88 e Código Penal no Pinecone (primeiro run)
// POST /api/setup/seed-legislacao
// Protegido por SETUP_SECRET (opcional em localhost)

import { NextRequest, NextResponse } from 'next/server'
import { runLegislacaoIngest } from '@/lib/run-legislacao-ingest'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SEEDED_FLAG_FILE = '.legislacao-seeded'

function isSeeded(): boolean {
  try {
    const filePath = path.join(process.cwd(), SEEDED_FLAG_FILE)
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function markSeeded(): void {
  try {
    const filePath = path.join(process.cwd(), SEEDED_FLAG_FILE)
    fs.writeFileSync(filePath, new Date().toISOString(), 'utf-8')
  } catch (err) {
    console.warn('[seed-legislacao] could not write flag file', err)
  }
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SETUP_SECRET
  if (!secret) {
    // Sem SETUP_SECRET: permite apenas em localhost
    const host = req.headers.get('host') || ''
    return host.startsWith('localhost') || host.startsWith('127.0.0.1')
  }
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  return auth.slice(7) === secret
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized. Set SETUP_SECRET or call from localhost.' }, { status: 401 })
  }

  if (isSeeded()) {
    return NextResponse.json({
      success: true,
      message: 'Legislação já foi inserida anteriormente. Use /api/admin/legislacao-ingest para reingestar.',
      skipped: true,
    })
  }

  const result = await runLegislacaoIngest({ dryRun: false, fonte: 'ambos' })

  if (result.success) {
    markSeeded()
  }

  return NextResponse.json(
    {
      success: result.success,
      namespace: result.namespace,
      vectorsPrepared: result.vectorsPrepared,
      vectorsUpserted: result.vectorsUpserted,
      error: result.error,
      message: result.success
        ? `CF/88 e Código Penal inseridos no RAG (${result.vectorsUpserted} vetores).`
        : result.error,
    },
    { status: result.success ? 200 : 500 }
  )
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    seeded: isSeeded(),
    message: isSeeded()
      ? 'Legislação já foi inserida. POST para forçar reingestão (apague .legislacao-seeded antes).'
      : 'Legislação ainda não inserida. POST para executar seed.',
  })
}