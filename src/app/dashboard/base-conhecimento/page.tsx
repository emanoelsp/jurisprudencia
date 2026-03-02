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
  BookOpen, Search, Trash2,
  Loader2, Calendar, User, Hash, AlertTriangle,
  ArrowLeft,
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
      toast.success('Jurisprudencia excluida.')
      closeDeleteDialog()
    } catch (err) {
      console.error('[jurisprudencia-delete] failed', err)
      toast.error('Erro ao excluir jurisprudencia.')
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

  // Detail view component
  const detailView = selected ? (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-slide-up">
      {/* Mobile back button */}
      <button
        onClick={() => setSelected(null)}
        className="lg:hidden btn-ghost py-1.5 px-2 text-xs -ml-2 mb-2"
      >
        <ArrowLeft size={14} />
        Voltar para lista
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-body font-bold text-brand-cream text-lg">{selected.tribunal}</span>
            <ConfidenceBadge badge={selected.confianca >= 80 ? 'alta' : selected.confianca >= 60 ? 'media' : 'baixa'} score={selected.confianca / 100} />
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-brand-slate text-xs flex-wrap">
            <span className="flex items-center gap-1"><Hash size={11} /> {selected.numero}</span>
            {selected.relator && <span className="flex items-center gap-1"><User size={11} /> {selected.relator}</span>}
            {selected.dataJulgamento && <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(selected.dataJulgamento)}</span>}
          </div>
        </div>
        <button onClick={() => openDeleteDialog(selected)} className="btn-ghost text-red-400 hover:text-red-300 py-1.5 px-2 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Ementa */}
      <div className="card p-4 sm:p-5 space-y-2">
        <p className="label">Ementa Original (TOON-Verificada)</p>
        <p className="font-body text-brand-slate text-sm leading-relaxed">{selected.ementa}</p>
      </div>

      {/* AI justification */}
      {selected.justificativaIa && (
        <div className="card p-4 sm:p-5 space-y-2 border-brand-indigo/20">
          <p className="label flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-indigo" />
            Justificativa do JurisprudencIA
          </p>
          <p className="font-body text-brand-slate text-sm leading-relaxed">{selected.justificativaIa}</p>
        </div>
      )}

      {/* Manual edits */}
      {selected.edicaoManual && (
        <div className="card p-4 sm:p-5 space-y-2 border-brand-gold/20">
          <p className="label flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-gold" />
            Edicao Manual do Advogado
          </p>
          <p className="font-body text-brand-slate text-sm leading-relaxed whitespace-pre-wrap">{selected.edicaoManual}</p>
        </div>
      )}

      {/* TOON data */}
      {selected.toonData && (
        <div className="card p-4 sm:p-5 space-y-3">
          <p className="label">Dados TOON (Anti-Alucinacao)</p>
          <div className="bg-brand-navy rounded-lg p-3 font-mono text-xs text-brand-slate space-y-1 overflow-x-auto">
            <p><span className="text-brand-gold">_type:</span> {selected.toonData._type}</p>
            <p><span className="text-brand-gold">numero:</span> {selected.toonData.numeroProcesso}</p>
            <p><span className="text-brand-gold">tribunal:</span> {selected.toonData.tribunal}</p>
            <p><span className="text-brand-gold">relator:</span> {selected.toonData.relator}</p>
            <p><span className="text-brand-gold">hash:</span> {selected.toonData.ementaHash}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-brand-slate border-t border-brand-border pt-4">
        <span>Atualizado em: {formatDate(selected.updatedAt || selected.createdAt)}</span>
        <span>Uso em processos: {selected.usageCount || selected.processoIds?.length || 1}</span>
        <span>Confianca original: {selected.confianca}%</span>
      </div>
    </div>
  ) : null

  // Placeholder view
  const placeholderView = (
    <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center p-12">
      <div className="w-16 h-16 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
        <BookOpen size={28} className="text-brand-gold" />
      </div>
      <div>
        <p className="font-display font-bold text-brand-cream text-lg">Base de Conhecimento</p>
        <p className="font-body text-brand-slate text-sm mt-1 max-w-sm">
          Selecione uma jurisprudencia para visualizar os detalhes, a analise de relevancia e o nivel de confianca original.
        </p>
      </div>
      <p className="font-body text-brand-slate text-xs">
        {items.length} jurisprudencia{items.length !== 1 ? 's' : ''} na base
      </p>
    </div>
  )

  // Sidebar list component
  const listPanel = (
    <div className={`flex flex-col h-full ${selected ? 'hidden lg:flex' : 'flex'}`}>
      <div className="p-4 sm:p-5 border-b border-brand-border">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <BookOpen size={18} className="text-brand-gold flex-shrink-0" />
          <h1 className="font-display font-bold text-brand-cream text-base sm:text-lg">Base de Conhecimento</h1>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-slate" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jurisprudencias..."
            className="input pl-8 text-xs"
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {(['all', 'reused', 'single'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setUsageFilter(filter)}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                usageFilter === filter
                  ? 'bg-brand-indigo/15 border-brand-indigo/30 text-brand-cream'
                  : 'border-brand-border text-brand-slate hover:text-brand-cream'
              }`}
            >
              {filter === 'all' ? 'Todas' : filter === 'reused' ? 'Reutilizadas' : 'Uso unico'}
            </button>
          ))}
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
              {search ? 'Nenhum resultado.' : 'Nenhuma jurisprudencia salva ainda.'}
            </p>
            <p className="font-body text-brand-slate text-xs">
              As jurisprudencias aprovadas nos processos aparecerao aqui.
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
                      {item.tribunal} -- {item.numero?.split('-')[0]}...
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
  )

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen overflow-hidden animate-fade-in">

      {/* Sidebar list - full width on mobile when no selection, 320px on desktop */}
      <div className={`w-full lg:w-80 border-r border-brand-border flex-shrink-0 ${selected ? 'hidden lg:block' : 'block'}`}>
        {listPanel}
      </div>

      {/* Detail view */}
      <div className={`flex-1 overflow-y-auto ${selected ? 'block' : 'hidden lg:block'}`}>
        {selected ? detailView : placeholderView}
      </div>

      {/* Delete dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
          <div className="card w-full sm:max-w-md p-5 sm:p-6 space-y-4 shadow-float rounded-t-2xl sm:rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center mt-0.5 flex-shrink-0">
                <AlertTriangle size={16} className="text-red-300" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-brand-cream">Excluir jurisprudencia</h3>
                <p className="font-body text-brand-slate text-xs mt-1">
                  Esta acao e irreversivel e removera a jurisprudencia da base de conhecimento.
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
                  Confirme digitando o numero do processo da jurisprudencia:
                </p>
                <p className="font-mono text-xs text-brand-cream bg-brand-navy border border-brand-border rounded-md px-3 py-2 break-all">
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
                    Excluir
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
