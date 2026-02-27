import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'
import { computeTrialEndsAt, normalizePlan, planForUserPlan } from '@/lib/plans'

export const runtime = 'nodejs'

function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const body = await req.json()
    const selectedPlan = normalizePlan(body?.plan)
    const email = normalizeEmail(body?.email || authUser.email)
    const displayName = String(body?.displayName || '').trim()

    if (!email) {
      return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 })
    }

    const db = adminDb()
    const userRef = db.collection('users').doc(authUser.uid)
    const userSnap = await userRef.get()
    const now = new Date().toISOString()
    const policy = planForUserPlan(selectedPlan)

    if (!userSnap.exists) {
      if (selectedPlan === 'free') {
        const freeRegistryRef = db.collection('billing_free_email_registry').doc(email)
        const freeRegistrySnap = await freeRegistryRef.get()
        if (freeRegistrySnap.exists) {
          const data = freeRegistrySnap.data() as any
          if (data.uid !== authUser.uid) {
            return NextResponse.json(
              { error: 'Este e-mail já utilizou o plano Free. Faça upgrade para continuar.' },
              { status: 409 }
            )
          }
        } else {
          await freeRegistryRef.set({
            email,
            uid: authUser.uid,
            firstUsedAt: now,
          })
        }
      }

      const trialEndsAt = selectedPlan === 'free' && policy.trialDays
        ? computeTrialEndsAt(now, policy.trialDays)
        : undefined

      await userRef.set({
        uid: authUser.uid,
        email,
        displayName: displayName || undefined,
        plano: selectedPlan,
        planoStatus: selectedPlan === 'free' ? 'trialing' : 'active',
        trialEndsAt: trialEndsAt || null,
        usageCounters: {},
        createdAt: now,
        updatedAt: now,
      })
    } else {
      const current = userSnap.data() as any
      if (!current?.plano) {
        await userRef.update({
          plano: selectedPlan,
          planoStatus: selectedPlan === 'free' ? 'trialing' : 'active',
          updatedAt: now,
        })
      }
    }

    const finalSnap = await userRef.get()
    return NextResponse.json({
      success: true,
      user: finalSnap.data(),
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message || 'Erro ao registrar plano' }, { status: 500 })
  }
}
