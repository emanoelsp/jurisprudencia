// GET /api/cron/stj-ingest
// Executado toda segunda-feira às 04:00 UTC pelo Vercel Cron (vercel.json).
// Vercel injeta automaticamente o header Authorization: Bearer {CRON_SECRET}.

import { NextRequest, NextResponse } from 'next/server'

export const runtime   = 'nodejs'
export const dynamic   = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve base URL: VERCEL_URL (auto-set), variável de app ou host da request
  const host     = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl  = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL
    || `${protocol}://${host}`

  const t0 = Date.now()
  console.log('[cron:stj-ingest] start', { baseUrl })

  try {
    const res = await fetch(`${baseUrl}/api/admin/stj-ckan-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ maxDocs: 80, maxResources: 3 }),
    })

    const data = await res.json().catch(() => ({}))
    const durationMs = Date.now() - t0
    console.log('[cron:stj-ingest] done', { ok: res.ok, durationMs, ...data })

    return NextResponse.json({ cron: 'stj-ingest', ok: res.ok, durationMs, ...data })
  } catch (err: any) {
    const durationMs = Date.now() - t0
    console.error('[cron:stj-ingest] failed', err)
    return NextResponse.json({ error: err.message, durationMs }, { status: 500 })
  }
}
