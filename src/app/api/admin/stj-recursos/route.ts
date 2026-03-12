// GET /api/admin/stj-recursos
// Lista recursos de jurisprudência do STJ Dados Abertos (CKAN) para ingest em lote

import { NextResponse } from 'next/server'
import { getStjAcordaosResourceUrls } from '@/lib/stj-dados-abertos'

export async function GET() {
  try {
    const urls = await getStjAcordaosResourceUrls()
    return NextResponse.json({ recursos: urls })
  } catch (err) {
    console.error('[stj-recursos]', err)
    return NextResponse.json(
      { error: 'Falha ao listar recursos STJ' },
      { status: 500 }
    )
  }
}
