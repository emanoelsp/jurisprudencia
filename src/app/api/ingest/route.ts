// src/app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromBuffer, extractMetadata } from '@/lib/rag'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ])
}

function quickMetadataFallback(text: string) {
  const numero = text.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] || ''
  const cliente =
    text.match(/(?:AUTOR\(A\)|AUTOR|REQUERENTE|CLIENTE)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const natureza = text.match(/(?:Classe|Natureza)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const vara = text.match(/(?:Vara|Órgão julgador|Orgao julgador)\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ''
  const tribunal = text.match(/\b(STJ|STF|TST|TJ[A-Z]{2}|TRF\d|TRT\d{1,2})\b/)?.[1] || ''
  return {
    numero,
    cliente,
    natureza,
    vara,
    tribunal,
    dataProtocolo: '',
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireServerAuth(req)
    const startedAt = Date.now()
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF.' }, { status: 400 })
    }

    console.log('[ingest] start', { fileName: file.name, sizeBytes: file.size })
    const buffer = Buffer.from(await file.arrayBuffer())
    const tExtract = Date.now()
    const text   = await extractTextFromBuffer(buffer)
    console.log('[ingest] extractTextFromBuffer done', { ms: Date.now() - tExtract, chars: text.length })

    // Auto-fill extraction
    const tMeta = Date.now()
    let metadata = quickMetadataFallback(text)
    try {
      metadata = await withTimeout(extractMetadata(text), 5000)
    } catch (metaErr) {
      console.warn('[ingest] extractMetadata timeout/fallback', metaErr)
    }
    console.log('[ingest] extractMetadata done', { ms: Date.now() - tMeta, metadata })

    console.log('[ingest] complete', { totalMs: Date.now() - startedAt })
    return NextResponse.json({
      text:     text.slice(0, 10000), // store first 10k chars
      metadata,
      chars:    text.length,
    })

  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ingest]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
