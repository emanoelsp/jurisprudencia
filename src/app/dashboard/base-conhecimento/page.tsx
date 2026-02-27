'use client'
// src/app/dashboard/base-conhecimento/page.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  collection, query, where, getDocs,
  doc, deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { JurisprudenciaCriada } from '@/types'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'
import {
  BookOpen, Search, Trash2, ExternalLink,
  Loader2, Calendar, User, Hash, AlertTriangle,
} from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BaseConhecimentoPage() {
  const { user }  = useAuth()
  const [items, setItems]   = useState<JurisprudenciaCriada[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [usageFilter, setUsageFilter] = useState<'all' | 'reused' | 'single'>('all')
  const [selected, setSelected] = useState<JurisprudenciaCriada | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JurisprudenciaCriada | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deletePhraseInput, setDeletePhraseInput] = useState('')
  const [deleteNumeroInput, setDeleteNumeroInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadItems() }, [user])

  async function loadItems() {
    if (!user) return
    const q = query(
      collection(db, 'jurisprudencias'),
      where('userId', '==', user.uid),
    )
    const snap = await getDocs(q)
    const data = snap.docs.map(d => {
      const item = { id: d.id, ...d.data() } as JurisprudenciaCriada
      const usageCount = item.usageCount || item.processoIds?.length || (item.processoId ? 1 : 0)
      return { ...item, usageCount }
    }) as JurisprudenciaCriada[]
    data.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
    setItems(data)
    setLoading(false)
  }

  function openDeleteDialog(item: JurisprudenciaCriada) {
    setDeleteTarget(item)
    setDeleteStep(1)
    setDeletePhraseInput('')
    setDeleteNumeroInput('')
  }

  function closeDeleteDialog() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteStep(1)
    setDeletePhraseInput('')
    setDeleteNumeroInput('')
  }

  async function confirmDeleteJurisprudencia() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'jurisprudencias', deleteTarget.id))
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
      if (selected?.id === deleteTarget.id) setSelected(null)
      toast.success('Jurisprudência excluída.')
      closeDeleteDialog()
    } catch (err) {
      console.error('[jurisprudencia-delete] failed', err)
      toast.error('Erro ao excluir jurisprudência.')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = items.filter(i => {
    const textMatch =
      i.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      i.numero?.toLowerCase().includes(search.toLowerCase()) ||
      i.tribunal?.toLowerCase().includes(search.toLowerCase()) ||
      i.ementa?.toLowerCase().includes(search.toLowerCase())

    if (!textMatch) return false

    const usage = i.usageCount || i.processoIds?.length || (i.processoId ? 1 : 0)
    if (usageFilter === 'reused') return usage > 1
    if (usageFilter === 'single') return usage <= 1
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden animate-fade-in">

      {/* ── Sidebar list ──────────────────────────────── */}
      <div className="w-80 border-r border-brand-border flex flex-col">
        <div className="p-5 border-b border-brand-border">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-brand-gold" />
            <h1 className="font-display font-bold text-brand-cream text-lg">Base de Conhecimento</h1>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-slate" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar jurisprudências…"
              className="input pl-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <button
              onClick={() => setUsageFilter('all')}
              className={`text-[11px] px-2 py-1 rounded-md border ${usageFilter === 'all' ? 'bg-brand-indigo/15 border-brand-indigo/30 text-brand-cream' : 'border-brand-border text-brand-slate'}`}
            >
              Todas
            </button>
            <button
              onClick={() => setUsageFilter('reused')}
              className={`text-[11px] px-2 py-1 rounded-md border ${usageFilter === 'reused' ? 'bg-brand-indigo/15 border-brand-indigo/30 text-brand-cream' : 'border-brand-border text-brand-slate'}`}
            >
              Reutilizadas
            </button>
            <button
              onClick={() => setUsageFilter('single')}
              className={`text-[11px] px-2 py-1 rounded-md border ${usageFilter === 'single' ? 'bg-brand-indigo/15 border-brand-indigo/30 text-brand-cream' : 'border-brand-border text-brand-slate'}`}
            >
              Uso único
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="text-brand-indigo animate-spin" size={20} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <BookOpen size={28} className="text-brand-border mx-auto" />
              <p className="font-body text-brand-slate text-xs">
                {search ? 'Nenhum resultado.' : 'Nenhuma jurisprudência salva ainda.'}
              </p>
              <p className="font-body text-brand-slate text-xs">
                As jurisprudências aprovadas nos processos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {filtered.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-brand-navy/40 transition-colors ${
                    selected?.id === item.id ? 'bg-brand-indigo/10 border-l-2 border-brand-indigo' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-brand-cream text-xs truncate">
                        {item.tribunal} · {item.numero?.split('-')[0]}…
                      </p>
                      <p className="font-body text-brand-slate text-xs mt-0.5 line-clamp-2">
                        {truncate(item.ementa || '', 80)}
                      </p>
                    </div>
                  </div>
	                  <div className="mt-2">
	                    <div className="flex items-center gap-2 flex-wrap">
	                      <ConfidenceBadge badge={item.confianca >= 80 ? 'alta' : item.confianca >= 60 ? 'media' : 'baixa'} score={item.confianca / 100} />
                        {(item.usageCount || 0) > 1 && (
                          <span className="badge-media text-[10px]">
                            reutilizada {item.usageCount}x
                          </span>
                        )}
	                    </div>
	                  </div>
	                </button>
	              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail view ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-12">
            <div className="w-16 h-16 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
              <BookOpen size={28} className="text-brand-gold" />
            </div>
            <div>
              <p className="font-display font-bold text-brand-cream text-lg">Base de Conhecimento</p>
              <p className="font-body text-brand-slate text-sm mt-1 max-w-sm">
                Selecione uma jurisprudência para visualizar os detalhes, a análise de relevância e o nível de confiança original.
              </p>
            </div>
            <p className="font-body text-brand-slate text-xs">
              {items.length} jurisprudência{items.length !== 1 ? 's' : ''} na base
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-8 space-y-6 animate-slide-up">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body font-bold text-brand-cream text-lg">{selected.tribunal}</span>
                  <ConfidenceBadge badge={selected.confianca >= 80 ? 'alta' : selected.confianca >= 60 ? 'media' : 'baixa'} score={selected.confianca / 100} />
                </div>
                <div className="flex items-center gap-4 text-brand-slate text-xs">
                  <span className="flex items-center gap-1"><Hash size={11} /> {selected.numero}</span>
                  {selected.relator && <span className="flex items-center gap-1"><User size={11} /> {selected.relator}</span>}
                  {selected.dataJulgamento && <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(selected.dataJulgamento)}</span>}
                </div>
              </div>
              <button onClick={() => openDeleteDialog(selected)} className="btn-ghost text-red-400 hover:text-red-300 py-1.5 px-2">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Ementa */}
            <div className="card p-5 space-y-2">
              <p className="label">Ementa Original (TOON-Verificada)</p>
              <p className="font-body text-brand-slate text-sm leading-relaxed">{selected.ementa}</p>
            </div>

            {/* AI justification */}
            {selected.justificativaIa && (
              <div className="card p-5 space-y-2 border-brand-indigo/20">
                <p className="label flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-indigo" />
                  Justificativa do JurisprudencIA
                </p>
                <p className="font-body text-brand-slate text-sm leading-relaxed">{selected.justificativaIa}</p>
              </div>
            )}

            {/* Manual edits */}
            {selected.edicaoManual && (
              <div className="card p-5 space-y-2 border-brand-gold/20">
                <p className="label flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-gold" />
                  Edição Manual do Advogado
                </p>
                <p className="font-body text-brand-slate text-sm leading-relaxed whitespace-pre-wrap">{selected.edicaoManual}</p>
              </div>
            )}

            {/* TOON data */}
            {selected.toonData && (
              <div className="card p-5 space-y-3">
                <p className="label">Dados TOON (Anti-Alucinação)</p>
                <div className="bg-brand-navy rounded-lg p-3 font-mono text-xs text-brand-slate space-y-1">
                  <p><span className="text-brand-gold">_type:</span> {selected.toonData._type}</p>
                  <p><span className="text-brand-gold">numero:</span> {selected.toonData.numeroProcesso}</p>
                  <p><span className="text-brand-gold">tribunal:</span> {selected.toonData.tribunal}</p>
                  <p><span className="text-brand-gold">relator:</span> {selected.toonData.relator}</p>
                  <p><span className="text-brand-gold">hash:</span> {selected.toonData.ementaHash}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-brand-slate border-t border-brand-border pt-4">
              <span>Atualizado em: {formatDate(selected.updatedAt || selected.createdAt)}</span>
              <span>Uso em processos: {selected.usageCount || selected.processoIds?.length || 1}</span>
              <span>Confiança original: {selected.confianca}%</span>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-float">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center mt-0.5">
                <AlertTriangle size={16} className="text-red-300" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-brand-cream">Excluir jurisprudência</h3>
                <p className="font-body text-brand-slate text-xs mt-1">
                  Esta ação é irreversível e removerá a jurisprudência da base de conhecimento.
                </p>
              </div>
            </div>

            {deleteStep === 1 && (
              <div className="space-y-3">
                <p className="font-body text-xs text-brand-slate">
                  Digite <span className="text-brand-cream font-semibold">excluir jurisprudencia</span> para continuar.
                </p>
                <input
                  value={deletePhraseInput}
                  onChange={e => setDeletePhraseInput(e.target.value)}
                  className="input"
                  placeholder="excluir jurisprudencia"
                />
                <div className="flex gap-2">
                  <button onClick={closeDeleteDialog} className="btn-ghost flex-1 justify-center">Cancelar</button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    disabled={deletePhraseInput.trim().toLowerCase() !== 'excluir jurisprudencia'}
                    className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="space-y-3">
                <p className="font-body text-xs text-brand-slate">
                  Confirme digitando o número do processo da jurisprudência:
                </p>
                <p className="font-mono text-xs text-brand-cream bg-brand-navy border border-brand-border rounded-md px-3 py-2">
                  {deleteTarget.numero}
                </p>
                <input
                  value={deleteNumeroInput}
                  onChange={e => setDeleteNumeroInput(e.target.value)}
                  className="input font-mono"
                  placeholder={deleteTarget.numero}
                />
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep(1)} className="btn-ghost flex-1 justify-center">Voltar</button>
                  <button
                    onClick={confirmDeleteJurisprudencia}
                    disabled={deleting || deleteNumeroInput.trim() !== deleteTarget.numero}
                    className="btn-gold flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir jurisprudência
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
