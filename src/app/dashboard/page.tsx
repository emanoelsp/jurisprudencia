'use client'
// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'
import type { Processo } from '@/types'
import { statusLabel, statusColor, formatDate, truncate } from '@/lib/utils'
import { FileText, TrendingUp, CheckCircle, Clock, Plus, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { user, userData } = useAuth()
  const [processos, setProcessos] = useState<Processo[]>([])
  const [stats, setStats]         = useState({ total: 0, analisados: 0, aprovados: 0, pendentes: 0 })
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    const q = query(
      collection(db, 'processos'),
      where('userId', '==', user!.uid),
    )
    const snap = await getDocs(q)
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Processo[]
    data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    setProcessos(data.slice(0, 5))

    const allQ = query(collection(db, 'processos'), where('userId', '==', user!.uid))
    const allSnap = await getDocs(allQ)
    const all = allSnap.docs.map(d => d.data()) as Processo[]
    setStats({
      total:     all.length,
      analisados: all.filter(p => p.status === 'analyzed').length,
      aprovados:  all.filter(p => p.status === 'approved').length,
      pendentes:  all.filter(p => p.status === 'pending').length,
    })
    setLoading(false)
  }

  const hora = new Date().getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 lg:space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-body text-brand-gold text-xs font-semibold uppercase tracking-widest">
            {formatDate(new Date().toISOString())}
          </p>
          <h1 className="section-title mt-1 text-xl sm:text-2xl">
            {greeting}, {userData?.displayName?.split(' ')[0] || 'Dr.'}
          </h1>
          <p className="font-body text-brand-slate text-sm mt-1">
            Sua plataforma de inteligencia juridica esta pronta.
          </p>
        </div>
        <Link href="/dashboard/processos" className="btn-primary self-start sm:self-auto">
          <Plus size={16} />
          Novo Processo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: FileText,    label: 'Total de Processos', value: stats.total,     color: 'text-brand-cream'   },
          { icon: Clock,       label: 'Pendentes',          value: stats.pendentes, color: 'text-amber-400'     },
          { icon: TrendingUp,  label: 'Analisados',         value: stats.analisados,color: 'text-brand-indigolt'},
          { icon: CheckCircle, label: 'Aprovados',          value: stats.aprovados, color: 'text-emerald-400'   },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Icon size={18} className={color} />
              <span className={`font-display font-bold text-2xl sm:text-3xl ${color}`}>{loading ? '...' : value}</span>
            </div>
            <p className="font-body text-brand-slate text-[11px] sm:text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent processes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-brand-border">
          <h2 className="font-display font-bold text-brand-cream text-base sm:text-lg">Processos Recentes</h2>
          <Link href="/dashboard/processos" className="btn-ghost text-xs gap-1">
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-brand-indigo border-t-transparent rounded-full animate-spin" />
          </div>
        ) : processos.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <FileText size={36} className="text-brand-border mx-auto" />
            <p className="font-body text-brand-slate text-sm">
              Nenhum processo ainda. Que tal comecar?
            </p>
            <Link href="/dashboard/processos" className="btn-primary inline-flex">
              <Plus size={14} />
              Adicionar primeiro processo
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {processos.map(p => (
              <Link
                key={p.id}
                href={`/dashboard/analisar/${p.id}`}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-brand-navy/50 transition-colors group"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center flex-shrink-0">
                  <FileText size={15} className="text-brand-indigo" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-semibold text-brand-cream text-sm truncate">
                    {p.cliente || '--'}
                  </p>
                  <p className="font-mono text-brand-slate text-[11px] sm:text-xs mt-0.5 truncate">
                    {p.numero || 'Numero pendente'}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <span className="font-body text-brand-slate text-xs hidden md:block">
                    {truncate(p.natureza || '', 30)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`status-dot ${statusColor(p.status)}`} />
                    <span className="font-body text-[11px] sm:text-xs text-brand-slate hidden sm:block">{statusLabel(p.status)}</span>
                  </div>
                  <ArrowRight size={14} className="text-brand-border group-hover:text-brand-indigo transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
