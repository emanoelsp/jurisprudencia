import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/auth/firebase-admin'
import { requireServerAuth } from '@/lib/auth/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isVercelBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com')
}

function extractFirebaseStoragePath(storageUrl: string): string | null {
  try {
    const url = new URL(storageUrl)
    const marker = '/o/'
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const db = adminDb()
    const snap = await db.collection('processos').doc(id).get()
    if (!snap.exists) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

    const processo = snap.data() as any
    if (processo.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (processo.status !== 'approved') {
      return NextResponse.json({ error: 'Download permitido apenas para processos aprovados.' }, { status: 403 })
    }

    const pdfHeaders = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="processo-${id}.pdf"`,
      'Cache-Control': 'private, max-age=60',
    }

    // Vercel Blob — stream server-side, URL nunca exposta ao client
    if (processo.storageUrl && isVercelBlobUrl(processo.storageUrl)) {
      const blobRes = await fetch(processo.storageUrl)
      if (!blobRes.ok) {
        return NextResponse.json({ error: 'PDF não encontrado.' }, { status: 404 })
      }
      return new NextResponse(blobRes.body, { headers: pdfHeaders })
    }

    // Compatibilidade retroativa: Firebase Storage (processos antigos)
    const storagePath =
      processo.storagePath ||
      (processo.storageUrl ? extractFirebaseStoragePath(processo.storageUrl) : null)

    if (storagePath) {
      try {
        const bucket = adminStorage().bucket()
        const file = bucket.file(storagePath)
        const [exists] = await file.exists()
        if (exists) {
          const [buffer] = await file.download()
          return new NextResponse(new Uint8Array(buffer), { headers: pdfHeaders })
        }
      } catch (err) {
        console.warn('[processes/download] firebase storage fallback failed', { id, storagePath, err })
      }
    }

    return NextResponse.json({ error: 'PDF não encontrado para este processo.' }, { status: 404 })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[processes/download]', err)
    return NextResponse.json({ error: err.message || 'Erro ao baixar PDF' }, { status: 500 })
  }
}
