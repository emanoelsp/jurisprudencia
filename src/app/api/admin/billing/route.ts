import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  plano1: 89.90,
  plano2: 179.90,
  escritorio: 459.90,
  start: 0,
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()
    const userSnap = await db.collection('users').doc(authUser.uid).get()
    if ((userSnap.data() as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)

    const usersSnap = await db.collection('users').get()

    type PlanStat = { count: number; revenue: number; active: number; trialing: number; canceled: number }
    const mrrByPlan: Record<string, PlanStat> = {}
    let totalMrr = 0, totalClients = 0, activeCount = 0, trialingCount = 0, canceledCount = 0

    usersSnap.forEach((doc: any) => {
      const data = doc.data()
      const plano = data.plano || 'free'
      const status = data.planoStatus || 'active'
      totalClients++
      if (!mrrByPlan[plano]) mrrByPlan[plano] = { count: 0, revenue: 0, active: 0, trialing: 0, canceled: 0 }
      mrrByPlan[plano].count++

      if (status === 'trialing') {
        trialingCount++
        mrrByPlan[plano].trialing++
      } else if (status === 'canceled') {
        canceledCount++
        mrrByPlan[plano].canceled++
      } else {
        const price = PLAN_PRICES[plano] ?? 0
        mrrByPlan[plano].revenue += price
        mrrByPlan[plano].active++
        totalMrr += price
        activeCount++
      }
    })

    let expenses: any[] = []
    try {
      const expSnap = await db.collection('admin_expenses').where('month', '==', month).get()
      expenses = expSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    } catch {
      // collection may not exist yet
    }

    const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)
    const fixedExpenses = expenses
      .filter((e: any) => e.type === 'fixed')
      .reduce((s: number, e: any) => s + (e.amount || 0), 0)
    const variableExpenses = expenses
      .filter((e: any) => e.type === 'variable')
      .reduce((s: number, e: any) => s + (e.amount || 0), 0)

    return NextResponse.json({
      month,
      mrr: totalMrr,
      mrrByPlan,
      totalClients,
      active: activeCount,
      trialing: trialingCount,
      canceled: canceledCount,
      expenses,
      totalExpenses,
      fixedExpenses,
      variableExpenses,
      netRevenue: totalMrr - totalExpenses,
    })
  } catch (err: any) {
    const status = String(err?.message || '').startsWith('UNAUTHORIZED:') ? 401 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
