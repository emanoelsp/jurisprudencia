'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Activity, Database, RefreshCw, ExternalLink,
  CheckCircle, AlertCircle, Loader2, Clock, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface IngestResult {
  ok?: boolean
  success?: boolean
  dryRun?: boolean
  docsParsed?: number
  vectorsPrepared?: number
  resourcesAttempted?: number
  namespace?: string
  durationMs?: number
  error?: string
}

export default function AdminPage() {
  const { user, userData } = useAuth()

  const [ingestRunning, setIngestRunning]   = useState(false)
  const [ingestResult, setIngestResult]     = useState<IngestResult | null>(null)
  const [maxDocs, setMaxDocs]               = useState(60)
  const [maxResources, setMaxResources]     = useState(3)
  const [dryRun, setDryRun]                 = useState(false)

  const isAdmin = userData?.role === 'admin'

  async function runStjIngest() {
    setIngestRunning(true)
    setIngestResult(null)
    const t0 = Date.now()
    try {
      const token = await user?.getIdToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/admin/stj-ckan-ingest', {
        method: 'POST',
        headers,
        body: JSON.stringify({ maxDocs, maxResources, dryRun }),
      })
      const data = await res.json()
      setIngestResult({ ...data, ok: res.ok, durationMs: Date.now() - t0 })
      if (res.ok) {
        toast.success(dryRun ? 'Dry run concluído.' : `${data.vectorsPrepared ?? 0} vetores indexados no Pinecone.`)
      } else {
        toast.error(data.error || 'Erro na ingestão.')
      }
    } catch (err: any) {
      setIngestResult({ ok: false, error: err.message, durationMs: Date.now() - t0 })
      toast.error(err.message)
    } finally {
      setIngestRunning(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-brand-slate text-sm">Acesso restrito.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-indigo/15 border border-brand-indigo/25 flex items-center justify-center">
          <Zap size={18} className="text-brand-indigo" />
        </div>
        <div>
          <h1 className="font-display font-bold text-brand-cream text-lg">Painel Admin</h1>
          <p className="font-body text-brand-slate text-xs">Ingestão de dados, observabilidade e cache.</p>
        </div>
      </div>

      {/* ── STJ CKAN Ingestão ── */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-brand-gold" />
          <h2 className="font-body font-semibold text-brand-cream text-sm">Ingestão STJ CKAN</h2>
          <span className="ml-auto text-[10px] text-brand-slate font-mono bg-brand-navy/60 px-2 py-0.5 rounded-full border border-brand-border">
            Cron: seg 04:00 UTC
          </span>
        </div>

        <p className="font-body text-brand-slate text-xs">
          Baixa acordãos do STJ via CKAN, gera embeddings e indexa no Pinecone (namespace <code className="text-brand-indigo">jurisprudencia_publica</code>).
          Sem isso, STJ não aparece nos resultados de análise.
        </p>

        {/* Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="label">Max documentos</span>
            <input
              type="number"
              min={1} max={200}
              value={maxDocs}
              onChange={e => setMaxDocs(Number(e.target.value))}
              className="input text-xs py-1.5"
            />
          </label>
          <label className="space-y-1">
            <span className="label">Max recursos CKAN</span>
            <input
              type="number"
              min={1} max={10}
              value={maxResources}
              onChange={e => setMaxResources(Number(e.target.value))}
              className="input text-xs py-1.5"
            />
          </label>
          <label className="flex items-center gap-2 pt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              className="accent-brand-indigo w-4 h-4"
            />
            <span className="font-body text-brand-slate text-xs">Dry run (sem upsert)</span>
          </label>
        </div>

        <button
          onClick={runStjIngest}
          disabled={ingestRunning}
          className="btn-gold text-xs py-2 px-4"
        >
          {ingestRunning
            ? <><Loader2 size={14} className="animate-spin" /> Ingerindo…</>
            : <><RefreshCw size={14} /> Executar ingestão STJ</>
          }
        </button>

        {/* Result */}
        {ingestResult && (
          <div className={`rounded-lg border p-4 space-y-2 ${
            ingestResult.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
          }`}>
            <div className="flex items-center gap-2">
              {ingestResult.ok
                ? <CheckCircle size={14} className="text-emerald-400" />
                : <AlertCircle size={14} className="text-red-400" />
              }
              <span className="font-body text-sm font-semibold text-brand-cream">
                {ingestResult.ok ? (ingestResult.dryRun ? 'Dry run OK' : 'Ingestão concluída') : 'Erro'}
              </span>
              {ingestResult.durationMs && (
                <span className="ml-auto font-mono text-[10px] text-brand-slate">
                  {(ingestResult.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            {ingestResult.ok && !ingestResult.error && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: 'Recursos CKAN', value: ingestResult.resourcesAttempted },
                  { label: 'Documentos', value: ingestResult.docsParsed },
                  { label: 'Vetores', value: ingestResult.vectorsPrepared },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-brand-navy/60 rounded-md p-2 border border-brand-border">
                    <div className="text-[9px] text-brand-slate/70 uppercase tracking-wider">{label}</div>
                    <div className="text-brand-cream font-display font-bold text-base mt-0.5">{value ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
            {ingestResult.error && (
              <p className="font-body text-red-300 text-xs">{ingestResult.error}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-brand-border">
          <Clock size={11} className="text-brand-slate/60" />
          <p className="font-body text-[10px] text-brand-slate/60">
            O cron automático roda toda segunda-feira às 04:00 UTC via <code>vercel.json</code>.
            Precisa de <code>CRON_SECRET</code> nas env vars da Vercel.
          </p>
        </div>
      </section>

      {/* ── Observabilidade Langfuse ── */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-brand-indigo" />
          <h2 className="font-body font-semibold text-brand-cream text-sm">Observabilidade — Langfuse</h2>
        </div>

        <p className="font-body text-brand-slate text-xs">
          Cada chamada ao <code>/api/analyze</code> gera um trace com <code>retrieval_confidence</code>,
          {' '}<code>evidence_coverage</code> e <code>generation_risk</code>. Configure as variáveis de ambiente
          para ativar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'LANGFUSE_PUBLIC_KEY', set: !!process.env.NEXT_PUBLIC_LANGFUSE_ENABLED },
            { label: 'LANGFUSE_SECRET_KEY', set: !!process.env.NEXT_PUBLIC_LANGFUSE_ENABLED },
            { label: 'LANGFUSE_HOST',       set: true }, // opcional — default cloud.langfuse.com
          ].map(({ label }) => (
            <div key={label} className="bg-brand-navy/60 rounded-md px-3 py-2 border border-brand-border flex items-center gap-2">
              <code className="text-[10px] text-brand-slate truncate">{label}</code>
            </div>
          ))}
        </div>

        <a
          href="https://cloud.langfuse.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs py-2 px-3 w-fit"
        >
          <ExternalLink size={13} />
          Abrir Langfuse Dashboard
        </a>
      </section>

      {/* ── Redis / Upstash ── */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-emerald-400" />
          <h2 className="font-body font-semibold text-brand-cream text-sm">Cache Redis — Upstash</h2>
        </div>

        <p className="font-body text-brand-slate text-xs">
          Cache L2 para embeddings (TTL 24h) persiste entre invocações serverless — reduz chamadas à API
          Gemini e latência do pipeline. Configure as variáveis para ativar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'].map(label => (
            <div key={label} className="bg-brand-navy/60 rounded-md px-3 py-2 border border-brand-border flex items-center gap-2">
              <code className="text-[10px] text-brand-slate truncate">{label}</code>
            </div>
          ))}
        </div>

        <a
          href="https://console.upstash.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs py-2 px-3 w-fit"
        >
          <ExternalLink size={13} />
          Abrir Upstash Console
        </a>
      </section>

    </div>
  )
}
