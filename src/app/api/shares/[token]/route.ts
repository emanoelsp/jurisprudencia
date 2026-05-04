// src/app/api/shares/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/auth/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params
    if (!token) return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })

    const db = adminDb()
    const snap = await db.collection('shares').doc(token).get()

    if (!snap.exists) {
      return NextResponse.json({ error: 'Link não encontrado ou expirado.' }, { status: 404 })
    }

    const data = snap.data() as {
      content: string
      title: string
      processNumber: string
      cliente: string
      expiresAt: string
      createdAt: string
    }

    if (new Date(data.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Este link expirou.' }, { status: 410 })
    }

    return NextResponse.json({
      title: data.title,
      content: data.content,
      processNumber: data.processNumber,
      cliente: data.cliente,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
