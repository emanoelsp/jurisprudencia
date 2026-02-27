// src/app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromBuffer, extractMetadata } from '@/lib/rag'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    const metadata = await extractMetadata(text)
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
