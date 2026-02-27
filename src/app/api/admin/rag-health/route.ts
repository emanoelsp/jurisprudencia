import { NextRequest, NextResponse } from 'next/server'
import { requireServerAuth } from '@/lib/server-auth'
import { Pinecone } from '@pinecone-database/pinecone'
import { namespaceForUser } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const apiKey = process.env.PINECONE_API_KEY
    const host = process.env.PINECONE_HOST?.replace(/\/$/, '')
    const indexName = process.env.PINECONE_INDEX
    const globalNamespace = process.env.PINECONE_NAMESPACE
    const userNamespace = namespaceForUser(authUser.uid)

    if (!apiKey || (!host && !indexName)) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: 'Pinecone não configurado (PINECONE_API_KEY e PINECONE_HOST/PINECONE_INDEX).',
      })
    }

    const pc = new Pinecone({ apiKey })
    const index = host
      ? pc.index({ host })
      : pc.index({ name: indexName! })

    const stats = await index.describeIndexStats()
    const namespaces = Object.entries(stats?.namespaces || {}).map(([name, data]) => ({
      namespace: name,
      vectorCount: Number((data as any)?.recordCount || 0),
    }))

    return NextResponse.json({
      ok: true,
      configured: true,
      host: host || null,
      indexName: indexName || null,
      globalNamespace: globalNamespace || null,
      userNamespace: userNamespace || null,
      totalVectorCount: Number((stats as any)?.totalRecordCount || 0),
      dimension: Number((stats as any)?.dimension || 0),
      namespaces,
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ ok: false, error: err.message || 'Erro no diagnóstico RAG' }, { status: 500 })
  }
}
