// src/app/api/shares/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXPIRY_DAYS = 7

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const body = await req.json()
    const { processId, content, title, processNumber, cliente } = body as {
      processId: string
      content: string
      title: string
      processNumber?: string
      cliente?: string
    }

    if (!processId || !content) {
      return NextResponse.json({ error: 'processId e content são obrigatórios.' }, { status: 400 })
    }

    const db = adminDb()

    // Verify ownership
    const procSnap = await db.collection('processos').doc(processId).get()
    if (!procSnap.exists || (procSnap.data() as any)?.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })
    }

    const token = crypto.randomUUID().replace(/-/g, '')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    await db.collection('shares').doc(token).set({
      token,
      processId,
      userId: authUser.uid,
      title: title || `${cliente || 'Parecer'} — ${processNumber || ''}`,
      content,
      processNumber: processNumber || '',
      cliente: cliente || '',
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    })

    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() })
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
