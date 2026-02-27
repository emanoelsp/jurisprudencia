// src/app/api/jurisprudencia/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import type { JurisprudenciaCriada } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { requireServerAuth } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const body = await req.json()
    const { processoId, result, justificativaIa, edicaoManual } = body

    if (!result) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const db = adminDb()
    const safeToonData = result.toonData || {
      _type: 'ToonJurisprudencia',
      _version: '1.0',
      numeroProcesso: String(result.numero || ''),
      tribunal: String(result.tribunal || ''),
      relator: String(result.relator || ''),
      dataJulgamento: String(result.dataJulgamento || ''),
      ementaHash: '',
      ementaOriginal: String(result.ementa || ''),
      classeProcessual: '',
      orgaoJulgador: '',
      tags: [],
    }

    const existingSnap = await db
      .collection('jurisprudencias')
      .where('userId', '==', authUser.uid)
      .where('numero', '==', result.numero)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0]
      const existing = existingDoc.data() as JurisprudenciaCriada
      const mergedProcessoIds = Array.from(new Set([...(existing.processoIds || [existing.processoId]), processoId].filter(Boolean)))
      await existingDoc.ref.update({
        processoIds: mergedProcessoIds,
        justificativaIa: existing.justificativaIa || justificativaIa || '',
        edicaoManual: edicaoManual || existing.edicaoManual || '',
        updatedAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, id: existingDoc.id, deduplicated: true })
    }

    const jurisprudencia: JurisprudenciaCriada = {
      id:              uuidv4(),
      processoId,
      processoIds:     processoId ? [processoId] : [],
      titulo:          `${result.tribunal} – ${result.numero}`,
      ementa:          result.ementa,
      tese:            edicaoManual || result.ementa,
      tribunal:        result.tribunal,
      numero:          result.numero,            // verbatim from TOON
      dataJulgamento:  result.dataJulgamento,
      relator:         result.relator,           // verbatim from TOON
      justificativaIa: justificativaIa || '',
      confianca:       Math.round((result.rerankScore ?? result.score) * 100),
      toonData:        safeToonData,             // full TOON payload preserved
      edicaoManual,
      aprovado:        true,
      userId:          authUser.uid,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    }

    await db.collection('jurisprudencias').doc(jurisprudencia.id).set(jurisprudencia)

    return NextResponse.json({ success: true, id: jurisprudencia.id })

  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[jurisprudencia]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)

    const db   = adminDb()
    const snap = await db
      .collection('jurisprudencias')
      .where('userId', '==', authUser.uid)
      .get()

    const items = snap.docs
      .map(d => {
        const item = d.data() as JurisprudenciaCriada
        const usageCount = (item.processoIds?.length || (item.processoId ? 1 : 0))
        return { ...item, usageCount }
      })
      .sort((a: any, b: any) =>
        String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
      )
      .slice(0, 50)

    return NextResponse.json({ items })

  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
