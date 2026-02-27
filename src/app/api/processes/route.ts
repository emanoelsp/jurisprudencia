// src/app/api/processes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'
import { normalizePlan, planForUserPlan, todayDateKey } from '@/lib/plans'
import { chunkText, generateEmbedding } from '@/lib/rag'
import { upsertPinecone } from '@/lib/pinecone'
import { namespaceForUser } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function freeTrialExpired(trialEndsAt?: string | null, createdAt?: string | null) {
  if (trialEndsAt) {
    return new Date(trialEndsAt).getTime() < Date.now()
  }
  if (createdAt) {
    const start = new Date(createdAt)
    start.setDate(start.getDate() + 7)
    return start.getTime() < Date.now()
  }
  return false
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const { searchParams } = new URL(req.url)
    const id     = searchParams.get('id')

    const db = adminDb()

    if (id) {
      const snap = await db.collection('processos').doc(id).get()
      if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const processo = snap.data() as any
      if (processo.userId !== authUser.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ processo: { id: snap.id, ...processo } })
    }

    const snap = await db
      .collection('processos')
      .where('userId', '==', authUser.uid)
      .get()

    const processos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

    return NextResponse.json({
      processos,
    })

  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const { id, updates } = await req.json()
    const db = adminDb()
    const ref = db.collection('processos').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const processo = snap.data() as any
    if (processo.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ref.update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const body = await req.json()
    const payload = body?.processo || body

    if (!payload?.numero || !payload?.cliente) {
      return NextResponse.json({ error: 'Número do processo e cliente são obrigatórios.' }, { status: 400 })
    }

    const db = adminDb()
    const userRef = db.collection('users').doc(authUser.uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuário sem plano provisionado.' }, { status: 409 })
    }

    const userData = userSnap.data() as any
    const planId = normalizePlan(userData.plano)
    const policy = planForUserPlan(planId)
    const today = todayDateKey()
    const usageCounters = userData.usageCounters || {}
    const usedToday = Number(usageCounters?.[today]?.processesCreated || 0)

    if (planId === 'free' && freeTrialExpired(userData.trialEndsAt, userData.createdAt)) {
      return NextResponse.json(
        { error: 'Seu período free de 7 dias terminou. Faça upgrade para continuar.' },
        { status: 402 }
      )
    }

    if (usedToday >= policy.limits.docsPerDay) {
      return NextResponse.json(
        { error: `Limite diário do plano ${policy.name} atingido (${policy.limits.docsPerDay} documentos/dia).` },
        { status: 402 }
      )
    }

    const processosSnap = await db.collection('processos').where('userId', '==', authUser.uid).get()
    const totalProcessos = processosSnap.size
    if (totalProcessos >= policy.limits.maxProcesses) {
      return NextResponse.json(
        { error: `Limite de processos do plano ${policy.name} atingido (${policy.limits.maxProcesses}).` },
        { status: 402 }
      )
    }

    const nowIso = new Date().toISOString()
    const processoRef = db.collection('processos').doc()

    await db.runTransaction(async tx => {
      const freshUserSnap = await tx.get(userRef)
      const freshUser = freshUserSnap.data() as any
      const freshCounters = freshUser?.usageCounters || {}
      const freshTodayUsed = Number(freshCounters?.[today]?.processesCreated || 0)
      if (freshTodayUsed >= policy.limits.docsPerDay) {
        throw new Error('LIMIT_DAILY')
      }

      tx.set(processoRef, {
        ...payload,
        userId: authUser.uid,
        createdAt: payload.createdAt || nowIso,
        updatedAt: nowIso,
      })

      tx.set(userRef, {
        usageCounters: {
          ...freshCounters,
          [today]: {
            processesCreated: freshTodayUsed + 1,
          },
        },
        updatedAt: nowIso,
      }, { merge: true })
    })

    // Optional automatic indexing in Pinecone so user RAG works immediately.
    if (process.env.PINECONE_API_KEY && process.env.PINECONE_HOST && String(payload?.textoOriginal || '').trim().length > 200) {
      try {
        const namespace = namespaceForUser(authUser.uid)
        const chunks = chunkText(String(payload.textoOriginal), 900, 180).slice(0, 6)
        const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
        for (let i = 0; i < chunks.length; i += 1) {
          const c = chunks[i]
          const emb = await generateEmbedding(c)
          vectors.push({
            id: `${processoRef.id}::proc::${i}`,
            values: emb,
            metadata: {
              fonte: 'base_interna',
              processoId: processoRef.id,
              numero: String(payload.numero || ''),
              tribunal: String(payload.tribunal || ''),
              relator: '',
              dataJulgamento: String(payload.dataProtocolo || ''),
              ementa: c.slice(0, 1800),
              texto: c.slice(0, 1800),
              userId: authUser.uid,
              ingestedAt: nowIso,
            },
          })
        }
        if (vectors.length > 0) {
          await upsertPinecone(vectors, namespace)
          console.log('[processes] pinecone upsert ok', {
            processoId: processoRef.id,
            namespace: namespace || 'default',
            vectors: vectors.length,
          })
        }
      } catch (pcErr) {
        console.warn('[processes] pinecone upsert failed (non-blocking)', pcErr)
      }
    }

    return NextResponse.json({ success: true, id: processoRef.id })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (String(err?.message || '') === 'LIMIT_DAILY') {
      return NextResponse.json({ error: 'Limite diário atingido para o seu plano.' }, { status: 402 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const db = adminDb()
    const ref = db.collection('processos').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const processo = snap.data() as any
    if (processo.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ref.delete()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
