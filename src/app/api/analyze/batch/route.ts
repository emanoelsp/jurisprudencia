// POST /api/analyze/batch
// Runs RAG analysis on multiple processes sequentially and saves results to Firestore.
// Plan-gated: Pro = 5, Escritório = 20, Enterprise = unlimited.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireServerAuth } from '@/lib/server-auth'
import { planForUserPlan, normalizePlan } from '@/lib/plans'
import { searchEproc, rerankResults, enrichWithToon, dedupeEprocResults, generateEmbedding } from '@/lib/rag'
import { queryPinecone } from '@/lib/pinecone'
import { namespaceForUser } from '@/lib/tenant'
import { sanitizePii } from '@/lib/pii'
import { writeAuditLog } from '@/lib/audit'
import { isLegalScopeText } from '@/lib/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TOP_K = 5

interface BatchResult {
  processoId: string
  status: 'ok' | 'skipped' | 'error'
  reason?: string
  resultsCount?: number
}

export async function POST(req: NextRequest) {
  let authUser: { uid: string }
  try {
    authUser = await requireServerAuth(req)
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { processoIds } = body as { processoIds?: string[] }

  if (!Array.isArray(processoIds) || processoIds.length === 0) {
    return NextResponse.json({ error: 'processoIds must be a non-empty array' }, { status: 400 })
  }

  const db = adminDb()
  const userSnap = await db.collection('users').doc(authUser.uid).get()
  const plan = planForUserPlan(normalizePlan((userSnap.data() as any)?.plano))

  if (!plan.limits.allowBatchAnalysis) {
    return NextResponse.json({ error: 'Análise em lote requer plano Pro ou superior.' }, { status: 402 })
  }

  const maxBatch = plan.limits.batchSize === 0 ? Infinity : plan.limits.batchSize
  const toProcess = processoIds.slice(0, maxBatch)
  const skipped = processoIds.length - toProcess.length

  const clientNamespace = namespaceForUser(authUser.uid)
  const results: BatchResult[] = []

  for (const processoId of toProcess) {
    try {
      const snap = await db.collection('processos').doc(processoId).get()
      if (!snap.exists) {
        results.push({ processoId, status: 'skipped', reason: 'not_found' })
        continue
      }
      const processo = snap.data() as any
      if (processo.userId !== authUser.uid) {
        results.push({ processoId, status: 'skipped', reason: 'forbidden' })
        continue
      }

      const texto = processo.textoOriginal || ''
      if (!texto || !isLegalScopeText(texto)) {
        results.push({ processoId, status: 'skipped', reason: 'no_text_or_out_of_scope' })
        continue
      }

      const textoParaIA = sanitizePii(texto)
      const tribunal = processo.tribunal || ''

      // Run core RAG pipeline (search + rerank only — no LLM justifications for batch)
      const embedding = await generateEmbedding(textoParaIA).catch(() => null)
      const [eprocResults, pineconeResults] = await Promise.allSettled([
        searchEproc(textoParaIA, TOP_K, tribunal ? { tribunal } : undefined),
        embedding
          ? queryPinecone(embedding, TOP_K, undefined, clientNamespace).catch(() => queryPinecone(embedding!, TOP_K, undefined, 'default'))
          : Promise.resolve([]),
      ])

      const combined = [
        ...(eprocResults.status === 'fulfilled' ? eprocResults.value : []),
        ...(pineconeResults.status === 'fulfilled' ? (pineconeResults.value as any[]) : []),
      ]

      const deduped = dedupeEprocResults(combined)
      const reranked = await rerankResults(textoParaIA, deduped).catch(() => deduped)
      const enriched = enrichWithToon(reranked.slice(0, TOP_K))

      // Save top result as draft into teseFinal
      const topResult = enriched[0]
      if (topResult) {
        const tese = `[Análise em lote — ${new Date().toLocaleDateString('pt-BR')}]\n\n` +
          `${topResult.tribunal} – ${topResult.numero}\n${topResult.ementa}\n`
        await db.collection('processos').doc(processoId).update({
          teseFinal: tese,
          status: 'analyzed',
          updatedAt: new Date().toISOString(),
        })
      }

      results.push({ processoId, status: 'ok', resultsCount: enriched.length })
    } catch (err: any) {
      console.error('[batch] processo error', processoId, err)
      results.push({ processoId, status: 'error', reason: err.message })
    }
  }

  if (plan.limits.allowAuditLog) {
    writeAuditLog({
      userId: authUser.uid,
      action: 'batch_analysis_run',
      meta: { total: processoIds.length, processed: results.filter(r => r.status === 'ok').length },
    })
  }

  const ok = results.filter(r => r.status === 'ok').length
  const errors = results.filter(r => r.status === 'error').length

  return NextResponse.json({ results, ok, errors, skipped, plan: plan.name, maxBatch: plan.limits.batchSize || 'unlimited' })
}
