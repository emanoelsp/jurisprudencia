// GET /api/escritorio/stats — usage stats for Escritório+ plan
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/auth/firebase-admin'
import { requireServerAuth } from '@/lib/auth/server-auth'
import { planForUserPlan, normalizePlan, todayDateKey } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()

    const userSnap = await db.collection('users').doc(authUser.uid).get()
    const userData = userSnap.data() as any
    const plan = planForUserPlan(normalizePlan(userData?.plano))

    if (!['escritorio', 'start'].includes(normalizePlan(userData?.plano))) {
      return NextResponse.json({ error: 'Requer plano Escritório ou superior.' }, { status: 402 })
    }

    const escritorio = userData?.escritorio || ''

    // Members: all users sharing the same escritorio name
    let members: any[] = []
    if (escritorio) {
      const membersSnap = await db.collection('users')
        .where('escritorio', '==', escritorio)
        .limit(plan.limits.maxUsers + 5)
        .get()
      members = membersSnap.docs.map(d => {
        const u = d.data() as any
        const today = todayDateKey()
        const docsToday = Number(u.usageCounters?.[today]?.processesCreated || 0)
        return {
          uid: d.id,
          displayName: u.displayName || u.email,
          email: u.email,
          plano: u.plano,
          docsToday,
          createdAt: u.createdAt,
        }
      })
    }

    // Processo stats for this user
    const processosSnap = await db.collection('processos')
      .where('userId', '==', authUser.uid)
      .get()
    const processos = processosSnap.docs.map(d => d.data() as any)
    const thisMonth = new Date()
    thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
    const processosThisMonth = processos.filter(p =>
      p.createdAt && new Date(p.createdAt) >= thisMonth
    ).length
    const approved = processos.filter(p => p.status === 'approved').length
    const analyzed = processos.filter(p => ['analyzed', 'approved'].includes(p.status)).length

    // Audit log entries (last 20 for this user)
    const auditSnap = await db.collection('auditLog')
      .where('userId', '==', authUser.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
    const recentActivity = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const today = todayDateKey()
    const docsToday = Number(userData?.usageCounters?.[today]?.processesCreated || 0)

    return NextResponse.json({
      plan: plan.name,
      maxUsers: plan.limits.maxUsers,
      docsPerDay: plan.limits.docsPerDay,
      escritorio,
      members,
      stats: {
        total: processos.length,
        thisMonth: processosThisMonth,
        analyzed,
        approved,
        docsToday,
        docsPerDayLimit: plan.limits.docsPerDay,
      },
      recentActivity,
    })
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
