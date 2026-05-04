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

export async function GET(req: NextRequest) {
  try {
    await assertAdmin(req)
    const db = adminDb()
    const url = new URL(req.url)
    const plano = url.searchParams.get('plano') || null
    const limit = Math.min(Number(url.searchParams.get('limit') || 500), 1000)

    let query: any = db.collection('users').orderBy('createdAt', 'desc').limit(limit)
    if (plano) query = query.where('plano', '==', plano)

    const snap = await query.get()
    const currentMonth = new Date().toISOString().slice(0, 7)

    const users = snap.docs.map((d: any) => {
      const data = d.data()
      const counters: Record<string, any> = data.usageCounters || {}
      const monthlyUsage = Object.entries(counters)
        .filter(([k]) => k.startsWith(currentMonth))
        .reduce((s, [, v]) => s + ((v as any)?.processesCreated || 0), 0)
      return {
        uid: d.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: data.role || 'cliente',
        plano: data.plano || 'free',
        planoStatus: data.planoStatus || 'active',
        trialEndsAt: data.trialEndsAt || null,
        escritorio: data.escritorio || null,
        createdAt: data.createdAt || '',
        monthlyUsage,
      }
    })

    return NextResponse.json({ users, total: users.length })
  } catch (err: any) {
    const status = String(err?.message || '').startsWith('UNAUTHORIZED:') ? 401 : (err?.status || 500)
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await assertAdmin(req)
    const db = adminDb()
    const { uid, plano, role, planoStatus } = await req.json()
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

    const update: Record<string, any> = {}
    if (plano !== undefined) update.plano = plano
    if (role !== undefined) update.role = role
    if (planoStatus !== undefined) update.planoStatus = planoStatus

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    }

    await db.collection('users').doc(uid).update(update)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const status = String(err?.message || '').startsWith('UNAUTHORIZED:') ? 401 : (err?.status || 500)
    return NextResponse.json({ error: err.message }, { status })
  }
}
