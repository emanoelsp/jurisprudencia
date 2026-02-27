import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { normalizePlan } from '@/lib/plans'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!accessToken) return NextResponse.json({ ok: true })

    const body = await req.json().catch(() => ({}))
    const type = body?.type || body?.action
    const paymentId = body?.data?.id || body?.id
    if (!paymentId || !String(type).includes('payment')) {
      return NextResponse.json({ ok: true })
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!paymentRes.ok) return NextResponse.json({ ok: true })
    const payment = await paymentRes.json()
    if (payment?.status !== 'approved') return NextResponse.json({ ok: true })

    const extRef = String(payment?.external_reference || '')
    const [uid, rawPlan] = extRef.split(':')
    const plan = normalizePlan(rawPlan)
    if (!uid || !rawPlan || plan === 'free') return NextResponse.json({ ok: true })

    const db = adminDb()
    await db.collection('users').doc(uid).set({
      plano: plan,
      planoStatus: 'active',
      updatedAt: new Date().toISOString(),
      billing: {
        provider: 'mercado_pago',
        lastPaymentId: String(paymentId),
        lastPaymentStatus: 'approved',
      },
    }, { merge: true })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
