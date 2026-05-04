'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { planForUserPlan, normalizePlan } from '@/lib/plans'
import type { AnalysisTemplate } from '@/types'
import { Plus, Pencil, Trash2, Loader2, FileText, Lock, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const STARTER_TEMPLATES: Pick<AnalysisTemplate, 'name' | 'description' | 'focusInstructions'>[] = [
  {
    name: 'Danos Morais',
    description: 'Foco em nexo causal e quantum indenizatório',
    focusInstructions: 'Priorize precedentes sobre danos morais, nexo causal e critérios de fixação do quantum indenizatório. Ao concluir, sugira o valor do pedido com base nos precedentes encontrados.',
  },
  {
    name: 'Defesa Criminal',
    description: 'Análise de materialidade, autoria e excludentes',
    focusInstructions: 'Analise com foco na defesa do réu: busque precedentes sobre ausência de materialidade, insuficiência de provas de autoria, excludentes de ilicitude (legítima defesa, estado de necessidade) e causas de diminuição de pena.',
  },
  {
    name: 'Recurso de Apelação',
    description: 'Erros in procedendo e in judicando',
    focusInstructions: 'Foco em vícios processuais (error in procedendo) e erros na aplicação do direito (error in judicando). Busque jurisprudência sobre reforma de sentença em instâncias superiores e precedentes vinculantes do STJ e STF.',
  },
  {
    name: 'Execução Fiscal',
    description: 'Exceções de pré-executividade e prescrição',
    focusInstructions: 'Priorize temas de execução fiscal: exceção de pré-executividade, prescrição e decadência tributária, penhora de bens, parcelamento e redirecionamento da execução a sócios.',
  },
]

export default function TemplatesPage() {
  const { user, userData } = useAuth()
  const plan = planForUserPlan(normalizePlan(userData?.plano))
  const canUse = plan.limits.allowCustomTemplates

  const [templates, setTemplates] = useState<AnalysisTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AnalysisTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', focusInstructions: '' })

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const token = await user?.getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function load() {
    if (!user || !canUse) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch('/api/templates', { headers: await getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setTemplates(data.templates || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [user, canUse])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', focusInstructions: '' })
    setShowModal(true)
  }

  function openEdit(t: AnalysisTemplate) {
    setEditing(t)
    setForm({ name: t.name, description: t.description || '', focusInstructions: t.focusInstructions })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.focusInstructions.trim()) {
      toast.error('Nome e instruções são obrigatórios.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ ...form, id: editing?.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar template')
      toast.success(editing ? 'Template atualizado.' : 'Template criado.')
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE', headers: await getAuthHeaders() })
      if (!res.ok) throw new Error('Erro ao excluir')
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template excluído.')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleting(null) }
  }

  async function importStarter(starter: typeof STARTER_TEMPLATES[0]) {
    setSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify(starter),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success(`Template "${starter.name}" importado.`)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="section-title text-xl sm:text-2xl">Templates de Análise</h1>
          <p className="font-body text-brand-slate text-sm mt-1">
            Instruções reutilizáveis que direcionam o foco da IA na análise.
          </p>
        </div>
        {canUse && (
          <button onClick={openCreate} className="btn-primary self-start sm:self-auto">
            <Plus size={15} /> Novo Template
          </button>
        )}
      </div>

      {!canUse && (
        <div className="card p-5 border-brand-gold/20 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0">
            <Lock size={18} className="text-brand-gold" />
          </div>
          <div>
            <p className="font-body font-semibold text-brand-cream text-sm">Recurso disponível no plano Pro</p>
            <p className="font-body text-brand-slate text-xs mt-1">
              Templates personalizados permitem salvar instruções específicas por tipo de caso — danos morais, defesa criminal, recurso de apelação — e reutilizá-las em qualquer análise.
            </p>
            <a href="/dashboard/planos" className="btn-gold text-xs py-1.5 px-3 mt-3 inline-flex items-center gap-1.5">
              Ver planos
            </a>
          </div>
        </div>
      )}

      {canUse && (
        <>
          {/* Templates list */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="card p-5 h-36 shimmer" />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="card p-8 text-center space-y-4">
              <FileText size={36} className="text-brand-border mx-auto" />
              <div>
                <p className="font-body font-semibold text-brand-cream text-sm">Nenhum template ainda</p>
                <p className="font-body text-brand-slate text-xs mt-1">Crie seu primeiro template ou importe um modelo abaixo.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="card p-5 space-y-3 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-bold text-brand-cream text-sm">{t.name}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(t)} className="btn-ghost p-1.5" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deleting === t.id}
                        className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                        title="Excluir"
                      >
                        {deleting === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                  {t.description && (
                    <p className="font-body text-brand-slate text-xs">{t.description}</p>
                  )}
                  <div className="mt-auto pt-2 border-t border-brand-border">
                    <p className="font-body text-brand-slate/70 text-[11px] line-clamp-2 italic">
                      "{t.focusInstructions.slice(0, 100)}{t.focusInstructions.length > 100 ? '…' : ''}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Starter templates */}
          <div className="card p-5 space-y-4">
            <p className="font-body font-semibold text-brand-cream text-sm">Modelos prontos para importar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_TEMPLATES.map(s => (
                <div key={s.name} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-brand-border hover:border-brand-indigo/30 transition-colors">
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-brand-cream">{s.name}</p>
                    <p className="font-body text-xs text-brand-slate truncate">{s.description}</p>
                  </div>
                  <button
                    onClick={() => importStarter(s)}
                    disabled={saving || templates.some(t => t.name === s.name)}
                    className="btn-ghost text-xs py-1 px-2 flex-shrink-0 disabled:opacity-40"
                  >
                    {templates.some(t => t.name === s.name)
                      ? <><Check size={11} className="text-emerald-400" /> Importado</>
                      : <><Plus size={11} /> Importar</>
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full sm:max-w-lg shadow-float rounded-t-2xl sm:rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-brand-border">
              <h2 className="font-display font-bold text-brand-cream text-lg">
                {editing ? 'Editar Template' : 'Novo Template'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Danos Morais — Nexo Causal"
                  className="input"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Breve descrição do foco"
                  className="input"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="label">Instruções para a IA *</label>
                <p className="font-body text-brand-slate text-[11px] mb-1.5">
                  Essas instruções são adicionadas ao prompt de análise. Seja específico sobre o que a IA deve priorizar.
                </p>
                <textarea
                  value={form.focusInstructions}
                  onChange={e => setForm(f => ({ ...f, focusInstructions: e.target.value }))}
                  placeholder="Ex: Priorize precedentes sobre danos morais e critérios de fixação do quantum indenizatório..."
                  className="input min-h-[100px] resize-y"
                  maxLength={800}
                />
                <p className="text-right text-[10px] text-brand-slate mt-1">{form.focusInstructions.length}/800</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center py-2.5">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center py-2.5">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
