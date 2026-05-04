// GET /api/cron/stf-ingest
// Executado toda segunda-feira às 05:00 UTC pelo Vercel Cron (vercel.json).
// Vercel injeta automaticamente o header Authorization: Bearer {CRON_SECRET}.

import { NextRequest, NextResponse } from 'next/server'

export const runtime   = 'nodejs'
export const dynamic   = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host     = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl  = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL
    || `${protocol}://${host}`

  const t0 = Date.now()
  console.log('[cron:stf-ingest] start', { baseUrl })

  try {
    const res = await fetch(`${baseUrl}/api/admin/stf-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ maxDocs: 60 }),
    })

    const data = await res.json().catch(() => ({}))
    const durationMs = Date.now() - t0
    console.log('[cron:stf-ingest] done', { ok: res.ok, durationMs, ...data })

    return NextResponse.json({ cron: 'stf-ingest', ok: res.ok, durationMs, ...data })
  } catch (err: any) {
    const durationMs = Date.now() - t0
    console.error('[cron:stf-ingest] failed', err)
    return NextResponse.json({ error: err.message, durationMs }, { status: 500 })
  }
}
