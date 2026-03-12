'use client'
// src/app/dashboard/analisar/[id]/page.tsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { normalizePlan } from '@/lib/plans'
import type { Processo, EprocResult, AnalysisChunk, JurisprudenciaCriada } from '@/types'
import EprocResultCard from '@/components/features/EprocResultCard'
import {
  Sparkles, Save, CheckCircle, AlertCircle,
  ArrowLeft, FileText, Loader2, Cpu,
  Shield, AlignLeft, Library, Database, Scale, BookOpen, Gavel, ChevronDown,
} from 'lucide-react'
import { statusLabel, statusColor, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

const TRIBUNAL_OPTIONS = [
  'TODOS',
  'STF', 'STJ', 'TST', 'TSE', 'STM',
  'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR',
  'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
]

const TRIBUNAL_GROUPS: { label: string; options: string[] }[] = [
  { label: 'Todos os tribunais', options: ['TODOS'] },
  { label: 'Superiores', options: ['STF', 'STJ', 'TST', 'TSE', 'STM'] },
  { label: 'TRFs', options: ['TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6'] },
  {
    label: 'TJs',
    options: ['TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO', 'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO'],
  },
]

export default function AnalisarPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const { user, userData }  = useAuth()
  const isFreePlan = normalizePlan(userData?.plano) === 'free'

  const [processo, setProcesso]           = useState<Processo | null>(null)
  const [loading, setLoading]             = useState(true)
  const [analyzing, setAnalyzing]         = useState(false)
  const [results, setResults]             = useState<EprocResult[]>([])
  const [justificativas, setJustificativas] = useState<Record<string, string>>({})
  const [streamingId, setStreamingId]     = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [saving, setSaving]               = useState(false)
  const [toonValid, setToonValid]         = useState<boolean | null>(null)
  const [usedPareceres, setUsedPareceres] = useState<JurisprudenciaCriada[]>([])
  const [knowledgeBasePareceres, setKnowledgeBasePareceres] = useState<JurisprudenciaCriada[]>([])
  const [leftTab, setLeftTab] = useState<'datajud' | 'bases_publicas' | 'codigo_penal' | 'constitucional' | 'pareceres'>('datajud')
  const [selectedTribunal, setSelectedTribunal] = useState('TJSP')
  const [tribunalDropdownOpen, setTribunalDropdownOpen] = useState(false)
  const tribunalDropdownRef = useRef<HTMLDivElement>(null)
  const [cfArticlesFromAnalysis, setCfArticlesFromAnalysis] = useState<Array<{ id: string; titulo: string; texto: string; aplicabilidade?: string }>>([])
  const [basesPublicasFromAnalysis, setBasesPublicasFromAnalysis] = useState<Array<{ id: string; tipo: string; fonte: string; ementa: string; aplicabilidade?: string }>>([])
  const [codigoPenalFromAnalysis, setCodigoPenalFromAnalysis] = useState<Array<{ id: string; tipo: string; fonte: string; ementa: string; aplicabilidade?: string }>>([])
  const [geminiQuotaExceeded, setGeminiQuotaExceeded] = useState(false)
  const [analysisConfidence, setAnalysisConfidence] = useState<{
    retrieval_confidence?: number
    evidence_coverage?: number
    generation_risk?: number
  } | null>(null)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [agentSteps, setAgentSteps] = useState<Array<{ label: string; done: boolean }>>([])
  const abortRef = useRef<AbortController | null>(null)

  const INITIAL_AGENT_STEPS = [
    { label: 'Analisei o texto do seu processo para entender o tema e os pedidos.', done: false },
    { label: 'Busquei jurisprudências compatíveis no DataJud (tribunais) e no seu acervo interno.', done: false },
    { label: 'Ordenei os resultados por relevância (rerank) e atribuí um percentual de confiança a cada um.', done: false },
    { label: 'Identifiquei artigos da Constituição Federal e do Código Penal aplicáveis ao caso.', done: false },
    { label: 'Gerei justificativas em linguagem natural para cada jurisprudência sugerida.', done: false },
  ]

  useEffect(() => { loadProcesso() }, [id])

  const loadKnowledgeBase = useCallback(async () => {
    try {
      const res = await fetch('/api/jurisprudencia', { headers: await getAuthHeaders() })
      if (!res.ok) return
      const data = await res.json()
      const items = (data.items || []).map((i: JurisprudenciaCriada) => ({
        ...i,
        usageCount: i.processoIds?.length || (i.processoId ? 1 : 0),
      }))
      setKnowledgeBasePareceres(items)
    } catch {
      // ignore
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user) return
    loadKnowledgeBase()
  }, [user?.uid, loadKnowledgeBase])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tribunalDropdownRef.current && !tribunalDropdownRef.current.contains(e.target as Node)) {
        setTribunalDropdownOpen(false)
      }
    }
    if (tribunalDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [tribunalDropdownOpen])

  async function loadProcesso() {
    const snap = await getDoc(doc(db, 'processos', id))
    if (!snap.exists()) { router.push('/dashboard/processos'); return }
    const p = { id: snap.id, ...snap.data() } as Processo
    setProcesso(p)
    setEditorContent(p.teseFinal || '')
    const tribunalDefault = (p.tribunal || 'TODOS').toUpperCase()
    setSelectedTribunal(TRIBUNAL_OPTIONS.includes(tribunalDefault) ? tribunalDefault : 'TODOS')
    setLoading(false)
  }

  async function getAuthHeaders() {
    const headers: Record<string, string> = {}
    const token = await user?.getIdToken()
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  async function startAnalysis(options?: { expandScope?: boolean }) {
    if (!processo || !processo.textoOriginal) {
      toast.error('Nenhum texto disponível para análise. Faça upload de um PDF.')
      return
    }

    setAnalyzing(true)
    setResults([])
    setJustificativas({})
    setCfArticlesFromAnalysis([])
    setBasesPublicasFromAnalysis([])
    setCodigoPenalFromAnalysis([])
    setGeminiQuotaExceeded(false)
    setAnalysisConfidence(null)
    setShowAgentModal(true)
    setAgentSteps(INITIAL_AGENT_STEPS.map((s, i) => ({ ...s, done: i === 0 })))
    abortRef.current = new AbortController()
    const t0 = performance.now()
    let chunkCount = 0

    try {
      console.log('[analysis] start', {
        processoId: id,
        textoChars: processo.textoOriginal.length,
      })
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          processoId: id,
          texto: processo.textoOriginal,
          tribunal: isFreePlan ? (processo.tribunal || 'TODOS') : selectedTribunal,
          expandScope: isFreePlan ? false : !!options?.expandScope,
        }),
        signal: abortRef.current.signal,
      })
      console.log('[analysis] fetch response', { status: res.status, ms: Math.round(performance.now() - t0) })

      if (!res.ok) {
        const errorMessage = await res.text()
        toast.error(errorMessage || 'Erro na análise. Tente novamente.')
        return
      }

      if (!res.body) throw new Error('No stream')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunkCount += 1
        if (chunkCount % 10 === 0) {
          console.log('[analysis] stream progress', {
            chunkCount,
            elapsedMs: Math.round(performance.now() - t0),
          })
        }
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const chunk: AnalysisChunk = JSON.parse(line.slice(6))
            handleChunk(chunk)
          } catch {}
        }
      }
      console.log('[analysis] stream complete', {
        chunkCount,
        totalMs: Math.round(performance.now() - t0),
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[analysis] failed', err)
        toast.error('Erro na análise. Tente novamente.')
      }
    } finally {
      console.log('[analysis] end', { totalMs: Math.round(performance.now() - t0) })
      setAnalyzing(false)
      setStreamingId(null)
      await updateDoc(doc(db, 'processos', id), { status: 'analyzed', updatedAt: new Date().toISOString() })
      setProcesso(p => p ? { ...p, status: 'analyzed' } : p)
    }
  }

  function handleChunk(chunk: AnalysisChunk) {
    switch (chunk.type) {
      case 'results':
        if (chunk.results) {
          setResults(chunk.results)
          setAgentSteps(prev => prev.map((s, i) => (i === 1 || i === 2 ? { ...s, done: true } : s)))
        }
        break
      case 'metadata':
        if (chunk.usedPareceres) setUsedPareceres(chunk.usedPareceres)
        if ((chunk.data as any)?.cf_articles) setCfArticlesFromAnalysis((chunk.data as any).cf_articles)
        if ((chunk.data as any)?.bases_publicas) setBasesPublicasFromAnalysis((chunk.data as any).bases_publicas)
        if ((chunk.data as any)?.codigo_penal) setCodigoPenalFromAnalysis((chunk.data as any).codigo_penal)
        if (
          typeof (chunk.data as any)?.retrieval_confidence === 'number' ||
          typeof (chunk.data as any)?.evidence_coverage === 'number' ||
          typeof (chunk.data as any)?.generation_risk === 'number'
        ) {
          setAnalysisConfidence(prev => ({
            ...(prev || {}),
            retrieval_confidence: (chunk.data as any)?.retrieval_confidence ?? prev?.retrieval_confidence,
            evidence_coverage: (chunk.data as any)?.evidence_coverage ?? prev?.evidence_coverage,
            generation_risk: (chunk.data as any)?.generation_risk ?? prev?.generation_risk,
          }))
        }
        if ((chunk.data as any)?.cf_articles?.length || (chunk.data as any)?.codigo_penal?.length) {
          setAgentSteps(prev => prev.map((s, i) => (i === 3 ? { ...s, done: true } : s)))
        }
        if ((chunk.data as any)?.gemini_quota_exceeded) {
          setGeminiQuotaExceeded(true)
        }
        break
      case 'justification':
        if ((chunk.data as any)?.id && chunk.text) {
          const id = String((chunk.data as any).id)
          setStreamingId(id)
          setJustificativas(prev => ({
            ...prev,
            [id]: (prev[id] || '') + chunk.text,
          }))
          setAgentSteps(prev => prev.map((s, i) => (i === 4 ? { ...s, done: true } : s)))
        }
        break
      case 'complete':
        setStreamingId(null)
        if ((chunk.data as any)?.id) setStreamingId(null)
        break
      case 'error':
        toast.error(chunk.error || 'Erro desconhecido.')
        break
    }
  }

  function insertText(text: string) {
    setEditorContent(prev => {
      const separator = prev.endsWith('\n') || prev === '' ? '' : '\n\n'
      return prev + separator + text
    })
    toast.success('Jurisprudência inserida no editor!', { icon: '📋' })
  }

  async function handleSave(approve = false) {
    setSaving(true)
    try {
      if (approve) {
        const persistSummary = await persistApprovedResults()
        if (persistSummary.total > 0 && persistSummary.saved === 0) {
          throw new Error('Não foi possível salvar as jurisprudências aprovadas na base de conhecimento.')
        }
      }

      const upd: Partial<Processo> = {
        teseFinal: editorContent,
        updatedAt: new Date().toISOString(),
      }
      if (approve) {
        upd.status = 'approved'
        upd.aprovadoPeloAdvogado = true
      }
      await updateDoc(doc(db, 'processos', id), upd)
      setProcesso(p => p ? { ...p, ...upd } : p)
      if (approve) loadKnowledgeBase()
      toast.success(approve ? 'Processo aprovado e salvo!' : 'Rascunho salvo!')
    } catch (err: any) {
      console.error('[save] failed', err)
      toast.error(err?.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function persistApprovedResults() {
    if (!user || results.length === 0) return { total: 0, saved: 0, failed: 0 }

    const payloads = results.slice(0, 5).map(result => ({
      processoId: id,
      result,
      justificativaIa: justificativas[result.id] || '',
      edicaoManual: editorContent || result.ementa,
    }))

    const responses = await Promise.all(
      payloads.map(async payload => {
        try {
          const res = await fetch('/api/jurisprudencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err?.error || `HTTP ${res.status}`)
          }
          return true
        } catch (err) {
          console.error('[approve] persist jurisprudencia failed', err)
          return false
        }
      })
    )
    const saved = responses.filter(Boolean).length
    const failed = responses.length - saved
    return { total: responses.length, saved, failed }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full p-12">
      <Loader2 className="text-brand-indigo animate-spin" size={32} />
    </div>
  )

  if (!processo) return null

  const avgConfidence = results.length
    ? Math.round(
        results.reduce((s, r) => s + (r.rerankScore ?? r.score) * 100, 0) / results.length
      )
    : 0

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Modal: O que o agente fez (linguagem natural) ───────────────── */}
      {showAgentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !analyzing && setShowAgentModal(false)}
          role="dialog"
          aria-labelledby="agent-modal-title"
        >
          <div
            className="bg-brand-navy border border-brand-border rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="agent-modal-title" className="font-display font-bold text-brand-cream text-lg flex items-center gap-2">
                <Sparkles size={20} className="text-brand-indigo" />
                Relatório da análise
              </h2>
              {!analyzing && (
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="text-brand-slate hover:text-brand-cream p-1 rounded"
                  aria-label="Fechar"
                >
                  ×
                </button>
              )}
            </div>
            <p className="font-body text-brand-slate text-sm mb-4">
              Uma visão clara do que foi feito e do nível de confiança nas sugestões.
            </p>

            <div className="rounded-lg border border-brand-border bg-black/10 p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-slate/70">Etapas</p>
                {analyzing ? (
                  <span className="inline-flex items-center gap-2 text-xs text-brand-indigo font-body">
                    <Loader2 size={14} className="animate-spin" /> Em andamento
                  </span>
                ) : (
                  <span className="text-xs text-brand-slate font-body">Concluído</span>
                )}
              </div>
              <ul className="space-y-3">
              {agentSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 font-body text-sm">
                  <div className="mt-0.5 flex-shrink-0">
                    {step.done ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                        <CheckCircle size={14} className="text-emerald-400" />
                      </span>
                    ) : analyzing ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-indigo/15 border border-brand-indigo/25">
                        <Loader2 size={14} className="text-brand-indigo animate-spin" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-brand-border text-[10px] text-brand-slate font-mono">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`leading-snug ${step.done ? 'text-brand-cream' : 'text-brand-slate'}`}>{step.label}</div>
                  </div>
                </li>
              ))}
              </ul>
            </div>

            {!analyzing && results.length > 0 && (
              <div className="rounded-lg border border-brand-indigo/20 bg-brand-indigo/10 p-4 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-slate/70 mb-2">Resumo</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-brand-border bg-black/10 p-2">
                    <div className="text-[10px] text-brand-slate/70 font-semibold uppercase tracking-wider">Resultados</div>
                    <div className="text-brand-cream font-display font-bold text-lg leading-tight">{results.length}</div>
                  </div>
                  <div className="rounded-md border border-brand-border bg-black/10 p-2">
                    <div className="text-[10px] text-brand-slate/70 font-semibold uppercase tracking-wider">Confiança média</div>
                    <div className="text-brand-cream font-display font-bold text-lg leading-tight">{avgConfidence > 0 ? `${avgConfidence}%` : '—'}</div>
                  </div>
                  <div className="rounded-md border border-brand-border bg-black/10 p-2">
                    <div className="text-[10px] text-brand-slate/70 font-semibold uppercase tracking-wider">Ação</div>
                    <div className="text-brand-slate text-xs leading-tight mt-1">Aprove apenas o que estiver bem fundamentado</div>
                  </div>
                </div>
              </div>
            )}

            {!analyzing && (
              <div className={`rounded-lg p-4 mb-4 border ${avgConfidence >= 75 ? 'bg-emerald-500/10 border-emerald-500/20' : avgConfidence > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-brand-navylt border-brand-border'}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-slate/70 mb-2">Confiabilidade</p>
                <p className="font-body text-brand-cream text-sm mb-3">
                  {avgConfidence >= 75 ? (
                    <span className="inline-flex items-center gap-2"><CheckCircle size={16} className="text-emerald-400" /> Confiança geral alta nas sugestões.</span>
                  ) : avgConfidence > 0 ? (
                    <span className="inline-flex items-center gap-2"><AlertCircle size={16} className="text-amber-400" /> Confiança geral moderada/baixa. Revise com cuidado antes de usar.</span>
                  ) : (
                    <span className="inline-flex items-center gap-2"><AlertCircle size={16} className="text-brand-slate" /> Não foi possível calcular confiança.</span>
                  )}
                </p>
                {analysisConfidence && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-black/10 rounded-md p-3 border border-brand-border">
                      <div className="text-[10px] text-brand-slate/70 font-semibold uppercase tracking-wider">Confiança da busca</div>
                      <div className="text-brand-cream font-display font-bold text-base mt-1">{analysisConfidence.retrieval_confidence != null ? `${Math.round(analysisConfidence.retrieval_confidence * 100)}%` : '—'}</div>
                    </div>
                    <div className="bg-black/10 rounded-md p-3 border border-brand-border">
                      <div className="text-[10px] text-brand-slate/70 font-semibold uppercase tracking-wider">Cobertura</div>
                      <div className="text-brand-cream font-display font-bold text-base mt-1">{analysisConfidence.evidence_coverage != null ? `${Math.round(analysisConfidence.evidence_coverage * 100)}%` : '—'}</div>
                    </div>
                    <div className="bg-black/10 rounded-md p-3 border border-brand-border">
                      <div className="text-[10px] text-brand-slate/70 font-semibold uppercase tracking-wider">Risco</div>
                      <div className="text-brand-cream font-display font-bold text-base mt-1">{analysisConfidence.generation_risk != null ? `${Math.round(analysisConfidence.generation_risk * 100)}%` : '—'}</div>
                    </div>
                  </div>
                )}
                {geminiQuotaExceeded && (
                  <p className="font-body text-amber-200 text-xs mt-3">
                    A API Gemini atingiu limite no momento; as abas Bases, CP e CF/88 podem ter ficado vazias.
                  </p>
                )}
              </div>
            )}
            {!analyzing && (
              <button
                type="button"
                onClick={() => setShowAgentModal(false)}
                className="btn-primary w-full py-2"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Top Bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-3 bg-brand-navylt border-b border-brand-border flex-shrink-0">
        <Link href="/dashboard/processos" className="btn-ghost py-1.5 px-2">
          <ArrowLeft size={15} />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${statusColor(processo.status)}`} />
            <span className="font-body text-xs text-brand-slate">{statusLabel(processo.status)}</span>
            {toonValid !== null && (
              <span className={`flex items-center gap-1 text-xs font-semibold ${toonValid ? 'text-emerald-400' : 'text-red-400'}`}>
                <Shield size={11} />
                TOON {toonValid ? 'OK' : 'Violação'}
              </span>
            )}
          </div>
          <h1 className="font-display font-bold text-brand-cream text-sm truncate">
            {processo.cliente} — <span className="font-mono font-normal text-brand-slate text-xs">{processo.numero}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => startAnalysis()}
            disabled={analyzing}
            className="btn-primary text-xs py-2 px-3"
          >
            {analyzing ? (
              <><Loader2 size={14} className="animate-spin" /> Analisando…</>
            ) : (
              <><Sparkles size={14} /> Analisar com JurisprudencIA</>
            )}
          </button>
          <button
            onClick={() => !isFreePlan && startAnalysis({ expandScope: true })}
            disabled={analyzing || isFreePlan}
            title={isFreePlan ? 'Faça upgrade para ampliar tribunais' : undefined}
            className={`text-xs py-2 px-3 ${isFreePlan ? 'opacity-50 cursor-not-allowed btn-ghost' : 'btn-ghost'}`}
          >
            Ampliar tribunais
          </button>

          <button onClick={() => handleSave(false)} disabled={saving} className="btn-ghost text-xs py-2 px-3">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>

          <button onClick={() => handleSave(true)} disabled={saving} className="btn-gold text-xs py-2 px-3">
            <CheckCircle size={14} />
            Aprovar
          </button>
        </div>
      </div>

      {/* ── Split Panel ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: eproc Results ─────────────────────── */}
        <div className="w-[45%] border-r border-brand-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border bg-brand-navylt flex-shrink-0">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-brand-indigo" />
              <span className="font-body font-semibold text-brand-cream text-sm">Resultados DataJud CNJ</span>
              {isFreePlan ? (
                <span className="bg-brand-navy/50 border border-brand-border rounded-md text-[11px] text-brand-slate px-2 py-1 font-mono">
                  {processo.tribunal || 'TODOS'}
                </span>
              ) : (
                <div ref={tribunalDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => !analyzing && setTribunalDropdownOpen(o => !o)}
                    disabled={analyzing}
                    className="inline-flex items-center gap-1.5 bg-brand-navy border border-brand-border hover:border-brand-indigo/40 rounded-lg text-xs font-medium text-brand-cream px-3 py-2 min-w-[5rem] transition-colors disabled:opacity-50"
                  >
                    <span className="font-mono">{selectedTribunal}</span>
                    <ChevronDown size={14} className={`text-brand-slate shrink-0 transition-transform ${tribunalDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {tribunalDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-brand-border bg-brand-navylt shadow-xl overflow-hidden">
                      <div className="max-h-[280px] overflow-y-auto py-2">
                        {TRIBUNAL_GROUPS.map(({ label, options }) => (
                          <div key={label}>
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-slate/70 border-b border-brand-border/50">
                              {label}
                            </div>
                            {options.map(sigla => (
                              <button
                                key={sigla}
                                type="button"
                                onClick={() => {
                                  setSelectedTribunal(sigla)
                                  setTribunalDropdownOpen(false)
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-mono transition-colors ${
                                  selectedTribunal === sigla
                                    ? 'bg-brand-indigo/20 text-brand-indigo'
                                    : 'text-brand-slate hover:bg-brand-navy hover:text-brand-cream'
                                }`}
                              >
                                <span>{sigla}</span>
                                {selectedTribunal === sigla && <CheckCircle size={14} className="text-brand-indigo shrink-0" />}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {results.length > 0 && (
                <>
                  <span className="bg-brand-indigo/20 text-brand-indigo text-xs px-2 py-0.5 rounded-full font-mono">
                    {results.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAgentModal(true)
                      if (results.length > 0) setAgentSteps(INITIAL_AGENT_STEPS.map(s => ({ ...s, done: true })))
                    }}
                    className="text-brand-indigo hover:text-brand-cream text-xs font-body"
                  >
                    O que o agente fez
                  </button>
                </>
              )}
            </div>
            {analyzing && (
              <div className="flex items-center gap-1.5 text-brand-indigo">
                <div className="w-1.5 h-1.5 bg-brand-indigo rounded-full animate-pulse" />
                <span className="font-body text-xs">Buscando…</span>
              </div>
            )}
          </div>

	          <p className="px-4 pt-2 text-[10px] text-brand-slate/80 font-body">
              As sugestões são de apoio à decisão. A responsabilidade pela peça e pelas citações é do advogado.
            </p>
	          <div className="px-4 pt-3 space-y-3">
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => setLeftTab('datajud')}
                  className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold border ${leftTab === 'datajud' ? 'border-brand-indigo/40 bg-brand-indigo/15 text-brand-cream' : 'border-brand-border text-brand-slate hover:text-brand-cream'}`}
                >
                  <span className="inline-flex items-center gap-0.5"><Database size={10} /> DataJud</span>
                </button>
                <button
                  onClick={() => setLeftTab('bases_publicas')}
                  className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold border ${leftTab === 'bases_publicas' ? 'border-brand-indigo/40 bg-brand-indigo/15 text-brand-cream' : 'border-brand-border text-brand-slate hover:text-brand-cream'}`}
                >
                  <span className="inline-flex items-center gap-0.5"><BookOpen size={10} /> Bases</span>
                </button>
                <button
                  onClick={() => setLeftTab('codigo_penal')}
                  className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold border ${leftTab === 'codigo_penal' ? 'border-brand-indigo/40 bg-brand-indigo/15 text-brand-cream' : 'border-brand-border text-brand-slate hover:text-brand-cream'}`}
                >
                  <span className="inline-flex items-center gap-0.5"><Gavel size={10} /> CP</span>
                </button>
                <button
                  onClick={() => setLeftTab('constitucional')}
                  className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold border ${leftTab === 'constitucional' ? 'border-brand-indigo/40 bg-brand-indigo/15 text-brand-cream' : 'border-brand-border text-brand-slate hover:text-brand-cream'}`}
                >
                  <span className="inline-flex items-center gap-0.5"><Scale size={10} /> CF/88</span>
                </button>
                <button
                  onClick={() => setLeftTab('pareceres')}
                  className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold border ${leftTab === 'pareceres' ? 'border-brand-indigo/40 bg-brand-indigo/15 text-brand-cream' : 'border-brand-border text-brand-slate hover:text-brand-cream'}`}
                >
                  <span className="inline-flex items-center gap-0.5"><Library size={10} /> Pareceres</span>
                </button>
              </div>
            </div>

	          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {leftTab === 'datajud' && (
              <>
	            {results.length === 0 && !analyzing && (
	              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center">
                  <Sparkles size={24} className="text-brand-indigo" />
                </div>
                <div>
                  <p className="font-body font-semibold text-brand-cream text-sm">Pronto para análise</p>
                  <p className="font-body text-brand-slate text-xs mt-1 max-w-xs">
                    Clique em "Analisar com JurisprudencIA" para buscar jurisprudências relevantes na base DataJud CNJ e no seu acervo interno.
                  </p>
                </div>
              </div>
            )}

            {analyzing && results.length === 0 && (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="card p-4 space-y-2 shimmer">
                    <div className="h-4 bg-brand-border rounded w-3/4" />
                    <div className="h-3 bg-brand-border rounded w-1/2" />
                    <div className="h-3 bg-brand-border rounded w-full" />
                  </div>
                ))}
              </div>
            )}

	            {results.map((result, i) => (
	              <EprocResultCard
                key={result.id}
                result={result}
                index={i}
                onInsert={insertText}
                streaming={streamingId === result.id}
	                justificativa={justificativas[result.id]}
	              />
	            ))}
              </>
            )}

            {leftTab === 'bases_publicas' && (
              <div className="space-y-3 px-4 pb-4">
                {basesPublicasFromAnalysis.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-body text-xs font-semibold text-brand-gold">
                      Bases públicas – legislação, súmulas, jurisprudência consolidada
                    </p>
                    {basesPublicasFromAnalysis.map(bp => (
                      <div key={bp.id} className="card p-4 space-y-2 border border-brand-indigo/20">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-body text-sm font-semibold text-brand-cream">{bp.fonte}</p>
                          <span className="badge-media text-[10px]">{bp.tipo}</span>
                        </div>
                        <p className="font-body text-brand-slate text-xs line-clamp-3">{bp.ementa}</p>
                        {bp.aplicabilidade && (
                          <p className="font-body text-brand-gold text-xs italic">{bp.aplicabilidade}</p>
                        )}
                        <button
                          onClick={() => insertText(`[${bp.fonte}]\n${bp.ementa}\n${bp.aplicabilidade ? `Aplicabilidade: ${bp.aplicabilidade}\n` : ''}\n`)}
                          className="btn-ghost text-xs py-1.5 px-2"
                        >
                          Inserir no editor
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 py-6">
                    <div className="w-10 h-10 rounded-lg bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={20} className="text-brand-indigo" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-brand-cream text-sm">Bases públicas</p>
                      {geminiQuotaExceeded ? (
                        <p className="font-body text-amber-400 text-xs mt-1">
                          Limite da API Gemini atingido. Aguarde alguns minutos ou verifique billing em <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener noreferrer" className="underline">ai.google.dev</a>.
                        </p>
                      ) : (
                        <>
                          <p className="font-body text-brand-slate text-xs mt-1">
                            Execute a análise para que a IA pesquise legislação, súmulas e jurisprudência consolidada relevantes ao processo.
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <a href="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-indigo hover:underline">CF/88</a>
                            <a href="https://www2.senado.leg.br/bdsf/bitstream/handle/id/608973/Codigo_penal_6ed.pdf?sequence=1&isAllowed=y" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-indigo hover:underline">Código Penal</a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'codigo_penal' && (
              <div className="space-y-3 px-4 pb-4">
                {codigoPenalFromAnalysis.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-body text-xs font-semibold text-brand-gold">
                      Artigos do Código Penal aplicáveis ao processo (IA analisou o processo e o CP)
                    </p>
                    {codigoPenalFromAnalysis.map(cp => (
                      <div key={cp.id} className="card p-4 space-y-2 border border-brand-indigo/20">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-body text-sm font-semibold text-brand-cream">{cp.fonte}</p>
                          <span className="badge-media text-[10px]">{cp.tipo}</span>
                        </div>
                        <p className="font-body text-brand-slate text-xs line-clamp-3">{cp.ementa}</p>
                        {cp.aplicabilidade && (
                          <p className="font-body text-brand-gold text-xs italic">{cp.aplicabilidade}</p>
                        )}
                        <button
                          onClick={() => insertText(`[${cp.fonte}]\n${cp.ementa}\n${cp.aplicabilidade ? `Aplicabilidade: ${cp.aplicabilidade}\n` : ''}\n`)}
                          className="btn-ghost text-xs py-1.5 px-2"
                        >
                          Inserir no editor
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 py-6">
                    <div className="w-10 h-10 rounded-lg bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center flex-shrink-0">
                      <Gavel size={20} className="text-brand-indigo" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-brand-cream text-sm">Código Penal</p>
                      {geminiQuotaExceeded ? (
                        <p className="font-body text-amber-400 text-xs mt-1">
                          Limite da API Gemini atingido. Aguarde alguns minutos ou verifique billing em <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener noreferrer" className="underline">ai.google.dev</a>.
                        </p>
                      ) : (
                        <>
                          <p className="font-body text-brand-slate text-xs mt-1">
                            Execute a análise para que a IA identifique os artigos do CP aplicáveis ao processo.
                          </p>
                          <a href="https://www2.senado.leg.br/bdsf/bitstream/handle/id/608973/Codigo_penal_6ed.pdf?sequence=1&isAllowed=y" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-indigo hover:underline mt-2 inline-block">Código Penal (Senado)</a>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'constitucional' && (
              <div className="space-y-3 px-4 pb-4">
                {cfArticlesFromAnalysis.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-body text-xs font-semibold text-brand-gold">
                      Artigos da CF/88 aplicáveis ao processo (IA analisou o processo e a Constituição)
                    </p>
                    {cfArticlesFromAnalysis.map(art => (
                      <div key={art.id} className="card p-4 space-y-2 border border-brand-gold/30">
                        <p className="font-body text-sm font-semibold text-brand-cream">{art.titulo}</p>
                        {art.aplicabilidade && (
                          <p className="font-body text-brand-gold text-xs italic">{art.aplicabilidade}</p>
                        )}
                        {art.texto && <p className="font-body text-brand-slate text-xs line-clamp-3">{art.texto}</p>}
                        <button
                          onClick={() => insertText(`[${art.titulo}]\n${art.texto || ''}\n${art.aplicabilidade ? `Aplicabilidade: ${art.aplicabilidade}\n` : ''}\n`)}
                          className="btn-ghost text-xs py-1.5 px-2"
                        >
                          Inserir no editor
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 py-6">
                    <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0">
                      <Scale size={20} className="text-brand-gold" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-brand-cream text-sm">Artigos da CF/88 aplicáveis</p>
                      {geminiQuotaExceeded ? (
                        <p className="font-body text-amber-400 text-xs mt-1">
                          Limite da API Gemini atingido. Aguarde alguns minutos ou verifique billing em <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener noreferrer" className="underline">ai.google.dev</a>.
                        </p>
                      ) : (
                        <>
                          <p className="font-body text-brand-slate text-xs mt-1">
                            Execute a análise para que a IA identifique, com base no processo e na Constituição (Planalto), quais artigos se enquadram.
                          </p>
                          <a href="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-gold hover:underline mt-2 inline-block">Constituição Federal (Planalto)</a>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'pareceres' && (
              <div className="space-y-3 px-4 pb-4">
                {knowledgeBasePareceres.length === 0 ? (
                  <div className="flex items-start gap-3 py-6">
                    <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0">
                      <Library size={20} className="text-brand-gold" />
                    </div>
                    <div>
                      <p className="font-body font-semibold text-brand-cream text-sm">Base de conhecimento</p>
                      <p className="font-body text-brand-slate text-xs mt-1">
                        Nenhuma jurisprudência aprovada ainda. Ao clicar em <strong>Aprovar</strong> nos resultados da análise, os pareceres passam a integrar sua base para reuso em outros processos.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-body text-xs font-semibold text-brand-gold">Jurisprudências já usadas (sua base)</p>
                    {knowledgeBasePareceres.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="card p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-body text-sm font-semibold text-brand-cream truncate">
                        {item.tribunal} · {item.numero}
                      </p>
                      <span className="badge-media text-[10px]">
                        usado {item.usageCount || item.processoIds?.length || 1}x
                      </span>
                    </div>
                    <p className="font-body text-brand-slate text-xs line-clamp-3">{item.ementa}</p>
                    <button
                      onClick={() => insertText(`${item.tribunal} – ${item.numero}\nEMENTA: ${item.ementa}\nRelator: ${item.relator || 'N/D'}, julgado em ${item.dataJulgamento || 'N/D'}.`)}
                      className="btn-ghost text-xs py-1.5 px-2"
                    >
                      Inserir no editor
                    </button>
                  </div>
                ))}
                  </>
                )}
              </div>
            )}
	          </div>
	        </div>

        {/* ── Right: Legal Editor ──────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border bg-brand-navylt flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlignLeft size={14} className="text-brand-gold" />
              <span className="font-body font-semibold text-brand-cream text-sm">
                Editor da Peça Final
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-body text-brand-slate text-xs">
                {editorContent.split(/\s+/).filter(Boolean).length} palavras
              </span>
              {processo.aprovadoPeloAdvogado && (
                <span className="badge-alta gap-1">
                  <CheckCircle size={10} />
                  Aprovado
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {/* Process header */}
              <div className="mb-6 pb-4 border-b border-brand-border space-y-1">
                <p className="font-body text-xs text-brand-gold font-semibold uppercase tracking-widest">
                  {processo.natureza || 'Peça Processual'}
                </p>
                <p className="font-mono text-xs text-brand-slate">{processo.numero}</p>
                <p className="font-body text-brand-slate text-xs">
                  {processo.cliente} · {processo.vara} · {processo.tribunal}
                </p>
              </div>

              <textarea
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                placeholder="O conteúdo da peça jurídica aparecerá aqui. Use o botão 'Inserir no Editor' nas jurisprudências ao lado para construir sua argumentação, ou escreva diretamente…"
                className="legal-editor w-full min-h-[500px] bg-transparent resize-none focus:outline-none text-sm leading-loose placeholder-brand-border"
              />
            </div>
          </div>

          {/* Editor footer info */}
          <div className="px-5 py-2 border-t border-brand-border bg-brand-navylt flex-shrink-0 flex items-center gap-4">
            <FileText size={12} className="text-brand-slate" />
            <span className="font-body text-brand-slate text-xs">
              Última edição: {formatDate(processo.updatedAt)}
            </span>
            {processo.scoreIa && (
              <span className="font-body text-brand-slate text-xs ml-auto">
                Score do JurisprudencIA: <span className="text-brand-indigo font-semibold">{processo.scoreIa}%</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
