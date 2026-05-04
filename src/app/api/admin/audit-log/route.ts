import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()
    const userSnap = await db.collection('users').doc(authUser.uid).get()
    if ((userSnap.data() as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const userId = url.searchParams.get('userId') || null
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)

    let q = db.collection('auditLog').orderBy('createdAt', 'desc').limit(limit)
    if (userId) q = q.where('userId', '==', userId) as any

    const snap = await (q as any).get()
    const entries = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))

    return NextResponse.json({ entries })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
