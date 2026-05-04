// GET /api/base-conhecimento/export
// Returns an HTML bundle of all approved pareceres for download.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/auth/firebase-admin'
import { requireServerAuth } from '@/lib/auth/server-auth'
import type { JurisprudenciaCriada } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

function buildHtml(items: JurisprudenciaCriada[]): string {
  const sections = items.map((item, i) => `
  <section class="parecer">
    <h2>${i + 1}. ${escapeHtml(item.tribunal)} — ${escapeHtml(item.numero)}</h2>
    <table class="meta">
      <tr><td>Confiança</td><td>${item.confianca}%</td></tr>
      ${item.relator ? `<tr><td>Relator</td><td>${escapeHtml(item.relator)}</td></tr>` : ''}
      ${item.dataJulgamento ? `<tr><td>Data</td><td>${formatDate(item.dataJulgamento)}</td></tr>` : ''}
      <tr><td>Usos</td><td>${item.usageCount ?? item.processoIds?.length ?? 1}</td></tr>
      <tr><td>Salvo em</td><td>${formatDate(item.createdAt)}</td></tr>
    </table>
    <h3>Ementa</h3>
    <p>${escapeHtml(item.ementa)}</p>
    ${item.justificativaIa ? `<h3>Justificativa da IA</h3><p>${escapeHtml(item.justificativaIa)}</p>` : ''}
    ${item.edicaoManual ? `<h3>Edição Manual</h3><p>${escapeHtml(item.edicaoManual)}</p>` : ''}
    ${item.toonData?.ementaHash ? `<p class="hash">TOON hash: ${item.toonData.ementaHash}</p>` : ''}
  </section>`).join('\n<hr>\n')

  const now = new Date().toLocaleDateString('pt-BR')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Base de Conhecimento — IurisPrudentIA</title>
<style>
  body { font-family: Georgia, serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a2e; }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #2d2d6b; padding-bottom: .5rem; }
  h2 { font-size: 1.2rem; color: #2d2d6b; margin-top: 2rem; }
  h3 { font-size: 1rem; color: #444; margin: 1rem 0 .25rem; }
  p { line-height: 1.7; margin: 0 0 .75rem; }
  table.meta { border-collapse: collapse; margin-bottom: 1rem; font-size: .85rem; }
  table.meta td { padding: 2px 12px 2px 0; }
  table.meta td:first-child { font-weight: bold; color: #555; width: 110px; }
  .hash { font-family: monospace; font-size: .75rem; color: #888; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
  .cover { text-align: center; margin-bottom: 3rem; }
  .cover p { color: #666; }
  @media print { hr { page-break-after: always; } }
</style>
</head>
<body>
<div class="cover">
  <h1>Base de Conhecimento</h1>
  <p>IurisPrudentIA · Exportado em ${now} · ${items.length} parecer${items.length !== 1 ? 'es' : ''}</p>
</div>
${sections}
</body>
</html>`
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)
    const db = adminDb()

    const snap = await db
      .collection('jurisprudencias')
      .where('userId', '==', authUser.uid)
      .get()

    const items: JurisprudenciaCriada[] = snap.docs
      .map(d => {
        const item = d.data() as JurisprudenciaCriada
        return { ...item, usageCount: item.processoIds?.length || (item.processoId ? 1 : 0) }
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

    const html = buildHtml(items)
    const filename = `base-conhecimento-${new Date().toISOString().slice(0, 10)}.html`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
