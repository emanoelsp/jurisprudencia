import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'

function extractStoragePathFromUrl(storageUrl: string): string | null {
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

    const storagePath =
      processo.storagePath ||
      (processo.storageUrl ? extractStoragePathFromUrl(processo.storageUrl) : null)

    if (storagePath) {
      try {
        const bucket = adminStorage().bucket()
        const file = bucket.file(storagePath)
        const [exists] = await file.exists()
        if (exists) {
          const [buffer] = await file.download()
          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="processo-${id}.pdf"`,
              'Cache-Control': 'private, max-age=60',
            },
          })
        }
        console.warn('[processes/download] file not found by storagePath, trying storageUrl fallback', {
          id,
          storagePath,
        })
      } catch (err) {
        console.warn('[processes/download] storagePath download failed, trying storageUrl fallback', {
          id,
          storagePath,
          err,
        })
      }
    }

    if (processo.storageUrl) {
      return NextResponse.redirect(processo.storageUrl)
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
