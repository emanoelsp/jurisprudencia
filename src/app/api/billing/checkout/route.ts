import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/server-auth'
import { PLAN_POLICIES, normalizePlan } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAN_PRICES: Record<string, number> = {
  plano1: 89.9,
  plano2: 179.9,
  escritorio: 459.9,
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const body = await req.json()
    const plan = normalizePlan(body?.plan)

    if (plan === 'free' || plan === 'start') {
      return NextResponse.json(
        { error: 'Plano não elegível para checkout automático.' },
        { status: 400 }
      )
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing MERCADO_PAGO_ACCESS_TOKEN' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const policy = PLAN_POLICIES[plan]
    const unitPrice = PLAN_PRICES[plan]

    const preferenceBody = {
      items: [
        {
          id: `jurisprudencia-${plan}`,
          title: `${policy.name} - JurisprudencIA`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: unitPrice,
        },
      ],
      external_reference: `${authUser.uid}:${plan}`,
      payer: {
        email: authUser.email,
      },
      back_urls: {
        success: `${appUrl}/dashboard/planos?status=success`,
        failure: `${appUrl}/dashboard/planos?status=failure`,
        pending: `${appUrl}/dashboard/planos?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/billing/webhook`,
    }

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || 'Falha ao criar checkout' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference_id: data.id,
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message || 'Erro no checkout' }, { status: 500 })
  }
}
