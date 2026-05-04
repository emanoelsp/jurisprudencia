'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { planForUserPlan, normalizePlan } from '@/lib/plans'
import {
  Building2, Users, FileText, CheckCircle, Loader2,
  BarChart3, Lock, RefreshCw, Sparkles, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface EscritorioStats {
  plan: string
  maxUsers: number
  docsPerDay: number
  escritorio: string
  members: Array<{ uid: string; displayName: string; email: string; docsToday: number; createdAt: string }>
  stats: {
    total: number
    thisMonth: number
    analyzed: number
    approved: number
    docsToday: number
    docsPerDayLimit: number
  }
  recentActivity: Array<{ id: string; action: string; processoId?: string; processoNumero?: string; createdAt: string }>
}

const ACTION_LABELS: Record<string, string> = {
  analysis_run:       'Análise executada',
  parecer_approved:   'Parecer aprovado',
  parecer_exported:   'Exportado',
  batch_analysis_run: 'Lote analisado',
  version_restored:   'Versão restaurada',
}

export default function EscritorioPage() {
  const { user, userData } = useAuth()
  const plan = planForUserPlan(normalizePlan(userData?.plano))
  const planId = normalizePlan(userData?.plano)
  const canUse = ['escritorio', 'start'].includes(planId)

  const [stats, setStats] = useState<EscritorioStats | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user || !canUse) { setLoading(false); return }
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/escritorio/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setStats(data)
      else toast.error(data?.error || 'Erro ao carregar dados')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user, canUse])

  if (!canUse) return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <h1 className="section-title text-xl sm:text-2xl">Dashboard do Escritório</h1>
      <div className="card p-6 border-brand-gold/20 flex items-start gap-4 max-w-xl">
        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0">
          <Lock size={18} className="text-brand-gold" />
        </div>
        <div>
          <p className="font-body font-semibold text-brand-cream text-sm">Disponível no plano Escritório</p>
          <p className="font-body text-brand-slate text-xs mt-1">
            Visão agregada de uso por membro, log de atividade da equipe e gestão de até {plan.limits.maxUsers} usuários.
          </p>
          <Link href="/dashboard/planos" className="btn-gold text-xs py-1.5 px-3 mt-3 inline-flex items-center gap-1.5">
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="section-title text-xl sm:text-2xl">Dashboard do Escritório</h1>
          <p className="font-body text-brand-slate text-sm mt-1">
            {stats?.escritorio
              ? <span className="text-brand-cream font-semibold">{stats.escritorio}</span>
              : 'Configure o nome do escritório em Meu Perfil'
            }
            {' · '}
            <span className="text-brand-gold">{stats?.plan}</span>
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost text-xs py-2 px-3 self-start sm:self-auto">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-5 h-24 shimmer" />)}
        </div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Processos este mês', value: stats.stats.thisMonth, icon: FileText, color: 'text-brand-indigo' },
              { label: 'Analisados', value: stats.stats.analyzed, icon: Sparkles, color: 'text-brand-gold' },
              { label: 'Aprovados', value: stats.stats.approved, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Docs hoje', value: `${stats.stats.docsToday}/${stats.stats.docsPerDayLimit}`, icon: BarChart3, color: 'text-brand-slate' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon size={14} className={color} />
                  <p className="font-body text-brand-slate text-xs">{label}</p>
                </div>
                <p className={`font-display font-bold text-2xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Usage bar */}
          <div className="card p-5 space-y-3">
            <p className="font-body font-semibold text-brand-cream text-sm">Uso diário</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-brand-slate">
                <span>{stats.stats.docsToday} docs usados hoje</span>
                <span>{stats.stats.docsPerDayLimit} limite/dia</span>
              </div>
              <div className="h-2.5 w-full bg-brand-navy rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.stats.docsToday / stats.stats.docsPerDayLimit > 0.8
                      ? 'bg-amber-400'
                      : 'bg-brand-indigo'
                  }`}
                  style={{ width: `${Math.min(100, (stats.stats.docsToday / stats.stats.docsPerDayLimit) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-brand-indigo" />
                <p className="font-body font-semibold text-brand-cream text-sm">Membros</p>
                <span className="text-[10px] text-brand-slate bg-brand-navy border border-brand-border rounded-full px-2 py-0.5 font-mono">
                  {stats.members.length}/{stats.maxUsers}
                </span>
              </div>
              <Link href="/dashboard/perfil" className="btn-ghost text-xs py-1 px-2">
                Gerenciar
              </Link>
            </div>

            {stats.members.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Building2 size={28} className="text-brand-border mx-auto" />
                <p className="font-body text-brand-slate text-xs">
                  Configure o nome do escritório em <Link href="/dashboard/perfil" className="text-brand-indigo hover:underline">Meu Perfil</Link> para agrupar membros.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {stats.members.map(m => (
                  <div key={m.uid} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 rounded-full bg-brand-indigo/20 border border-brand-indigo/30 flex items-center justify-center text-brand-indigo font-bold text-xs flex-shrink-0">
                      {(m.displayName || m.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-brand-cream truncate">{m.displayName}</p>
                      <p className="font-body text-[11px] text-brand-slate truncate">{m.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-body text-xs text-brand-cream font-semibold">{m.docsToday}</p>
                      <p className="font-body text-[10px] text-brand-slate">docs hoje</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          {stats.recentActivity.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-brand-slate" />
                <p className="font-body font-semibold text-brand-cream text-sm">Atividade recente</p>
              </div>
              <div className="space-y-2">
                {stats.recentActivity.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-center gap-3 text-xs">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium flex-shrink-0 ${
                      a.action === 'analysis_run'      ? 'text-brand-indigo border-brand-indigo/30 bg-brand-indigo/10' :
                      a.action === 'parecer_approved'  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                      'text-brand-gold border-brand-gold/30 bg-brand-gold/10'
                    }`}>
                      {ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    {a.processoNumero && (
                      <span className="font-mono text-brand-slate text-[10px] truncate">{a.processoNumero}</span>
                    )}
                    <span className="ml-auto text-brand-slate/60 flex-shrink-0 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card p-8 text-center">
          <p className="font-body text-brand-slate text-sm">Erro ao carregar dados. Tente atualizar.</p>
        </div>
      )}
    </div>
  )
}
