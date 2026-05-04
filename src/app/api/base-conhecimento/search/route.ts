// POST /api/base-conhecimento/search
// Semantic search in the user's private Pinecone namespace (cli-{userId}).
// Returns matching jurisprudencias from Firestore ordered by vector similarity.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/auth/firebase-admin'
import { requireServerAuth } from '@/lib/auth/server-auth'
import { generateEmbedding } from '@/lib/ai/rag'
import { queryPinecone } from '@/lib/ai/pinecone'
import { namespaceForUser } from '@/lib/tenant'
import type { JurisprudenciaCriada } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const { query } = await req.json()

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'Query must be at least 3 characters.' }, { status: 400 })
    }

    const namespace = namespaceForUser(authUser.uid)
    if (!namespace) {
      return NextResponse.json({ items: [] })
    }

    // Generate embedding and query user's private Pinecone namespace
    const vector = await generateEmbedding(query.trim())
    const pineconeRes = await queryPinecone(vector, 20, undefined, namespace)
    const matches = Array.isArray(pineconeRes?.matches) ? pineconeRes.matches : []

    if (matches.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // Extract process numbers from Pinecone matches to look up in Firestore
    const numeroSet = new Set<string>()
    for (const m of matches) {
      const n = String(m.metadata?.numero || m.metadata?.processo || '')
      if (n) numeroSet.add(n)
    }

    const db = adminDb()
    const snap = await db
      .collection('jurisprudencias')
      .where('userId', '==', authUser.uid)
      .get()

    // Build score map from Pinecone results
    const scoreByNumero = new Map<string, number>()
    for (const m of matches) {
      const n = String(m.metadata?.numero || m.metadata?.processo || '')
      if (n) scoreByNumero.set(n, Number(m.score) || 0)
    }

    const items = snap.docs
      .map(d => {
        const item = d.data() as JurisprudenciaCriada
        const pineconeScore = scoreByNumero.get(item.numero) ?? 0
        return {
          ...item,
          usageCount: item.processoIds?.length || (item.processoId ? 1 : 0),
          _pineconeScore: pineconeScore,
        }
      })
      .filter(item => {
        // Include items that appear in Pinecone results OR have text overlap with query
        if (item._pineconeScore > 0) return true
        const q = query.toLowerCase()
        return (
          item.tribunal?.toLowerCase().includes(q) ||
          item.ementa?.toLowerCase().includes(q) ||
          item.numero?.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b._pineconeScore - a._pineconeScore)
      .slice(0, 20)
      .map(({ _pineconeScore, ...item }) => item)

    return NextResponse.json({ items })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[base-conhecimento/search]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
