// GET /api/admin/health — checks API key presence and quota status
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/auth/firebase-admin'
import { requireServerAuth } from '@/lib/auth/server-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ServiceHealth {
  name: string
  configured: boolean
  status: 'ok' | 'warn' | 'error' | 'unknown'
  detail?: string
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()
    const userSnap = await db.collection('users').doc(authUser.uid).get()
    if ((userSnap.data() as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const services: ServiceHealth[] = [
      {
        name: 'Gemini (Google AI)',
        configured: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        status: (!!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY) ? 'ok' : 'error',
        detail: 'GEMINI_API_KEY',
      },
      {
        name: 'Pinecone',
        configured: !!(process.env.PINECONE_API_KEY && process.env.PINECONE_HOST),
        status: !!(process.env.PINECONE_API_KEY && process.env.PINECONE_HOST) ? 'ok' : 'error',
        detail: 'PINECONE_API_KEY + PINECONE_HOST',
      },
      {
        name: 'Cohere (rerank)',
        configured: !!process.env.COHERE_API_KEY,
        status: !!process.env.COHERE_API_KEY ? 'ok' : 'warn',
        detail: 'COHERE_API_KEY — fallback lexical ativo se ausente',
      },
      {
        name: 'Upstash Redis (cache)',
        configured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
        status: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ? 'ok' : 'warn',
        detail: 'Cache L2 de embeddings — opcional, fallback in-memory',
      },
      {
        name: 'Langfuse (observabilidade)',
        configured: !!process.env.LANGFUSE_SECRET_KEY,
        status: !!process.env.LANGFUSE_SECRET_KEY ? 'ok' : 'warn',
        detail: 'Traces de análise — opcional',
      },
      {
        name: 'Mercado Pago',
        configured: !!(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN),
        status: !!(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN) ? 'ok' : 'warn',
        detail: 'Checkout e webhooks de pagamento',
      },
      {
        name: 'Resend (e-mail)',
        configured: !!process.env.RESEND_API_KEY,
        status: !!process.env.RESEND_API_KEY ? 'ok' : 'warn',
        detail: 'E-mail de boas-vindas — opcional',
      },
      {
        name: 'Groq (LLM fallback)',
        configured: !!process.env.GROQ_API_KEY,
        status: !!process.env.GROQ_API_KEY ? 'ok' : 'warn',
        detail: 'Fallback 2 do LLM — recomendado para produção',
      },
    ]

    const errors = services.filter(s => s.status === 'error').length
    const warnings = services.filter(s => s.status === 'warn').length

    return NextResponse.json({ services, errors, warnings, checkedAt: new Date().toISOString() })
  } catch (err: any) {
    if (String(err?.message).startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
