import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'
import { planForUserPlan, normalizePlan } from '@/lib/plans'
import type { AnalysisTemplate } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()
    const snap = await db.collection('templates').where('userId', '==', authUser.uid).get()
    const templates = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AnalysisTemplate[]
    templates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return NextResponse.json({ templates })
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()
    const userSnap = await db.collection('users').doc(authUser.uid).get()
    const plan = planForUserPlan(normalizePlan((userSnap.data() as any)?.plano))

    if (!plan.limits.allowCustomTemplates) {
      return NextResponse.json({ error: 'Templates personalizados requerem plano Pro ou superior.' }, { status: 402 })
    }

    const body = await req.json()
    const { name, description, focusInstructions, id } = body as Partial<AnalysisTemplate>

    if (!name?.trim() || !focusInstructions?.trim()) {
      return NextResponse.json({ error: 'name e focusInstructions são obrigatórios.' }, { status: 400 })
    }

    // Update existing
    if (id) {
      const ref = db.collection('templates').doc(id)
      const snap = await ref.get()
      if (!snap.exists || (snap.data() as any).userId !== authUser.uid) {
        return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
      }
      await ref.update({ name: name.trim(), description: description?.trim() || '', focusInstructions: focusInstructions.trim(), updatedAt: new Date().toISOString() })
      return NextResponse.json({ success: true, id })
    }

    // Create new
    const newId = uuidv4()
    const template: AnalysisTemplate = {
      id: newId,
      userId: authUser.uid,
      name: name.trim(),
      description: description?.trim() || '',
      focusInstructions: focusInstructions.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.collection('templates').doc(newId).set(template)
    return NextResponse.json({ success: true, id: newId, template })
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = adminDb()
    const ref = db.collection('templates').doc(id)
    const snap = await ref.get()
    if (!snap.exists || (snap.data() as any).userId !== authUser.uid) {
      return NextResponse.json({ error: 'Template não encontrado.' }, { status: 404 })
    }
    await ref.delete()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
