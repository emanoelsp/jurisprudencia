import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function assertAdmin(req: NextRequest) {
  const authUser = await requireServerAuth(req)
  const db = adminDb()
  const snap = await db.collection('users').doc(authUser.uid).get()
  if ((snap.data() as any)?.role !== 'admin') {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
  return authUser
}

export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req)
    const db = adminDb()
    const { type, category, name, amount, month, userId, notes } = await req.json()

    if (!type || !name || amount == null || !month) {
      return NextResponse.json({ error: 'type, name, amount, month são obrigatórios' }, { status: 400 })
    }

    const doc = await db.collection('admin_expenses').add({
      type,
      category: category || 'other',
      name,
      amount: Number(amount),
      month,
      ...(userId ? { userId } : {}),
      ...(notes ? { notes } : {}),
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ id: doc.id })
  } catch (err: any) {
    const status = String(err?.message || '').startsWith('UNAUTHORIZED:') ? 401 : (err?.status || 500)
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await assertAdmin(req)
    const db = adminDb()
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const allowed = ['type', 'category', 'name', 'amount', 'month', 'userId', 'notes']
    const clean: Record<string, any> = { updatedAt: new Date().toISOString() }
    for (const k of allowed) {
      if (updates[k] !== undefined) {
        clean[k] = k === 'amount' ? Number(updates[k]) : updates[k]
      }
    }

    await db.collection('admin_expenses').doc(id).update(clean)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const status = String(err?.message || '').startsWith('UNAUTHORIZED:') ? 401 : (err?.status || 500)
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await assertAdmin(req)
    const db = adminDb()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    await db.collection('admin_expenses').doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const status = String(err?.message || '').startsWith('UNAUTHORIZED:') ? 401 : (err?.status || 500)
    return NextResponse.json({ error: err.message }, { status })
  }
}
