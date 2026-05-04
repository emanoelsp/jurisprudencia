'use client'
// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'
import type { Processo } from '@/types'
import { statusLabel, statusColor, formatDate, truncate } from '@/lib/utils'
import { FileText, TrendingUp, CheckCircle, Clock, Plus, ArrowRight, Upload, Sparkles, PenLine } from 'lucide-react'
import { SkeletonStats, SkeletonList } from '@/components/ui/Skeleton'

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

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <div className="h-6 w-48 bg-brand-border/60 rounded animate-pulse" />
        <div className="h-4 w-32 bg-brand-border/40 rounded animate-pulse" />
      </div>
      <SkeletonStats />
      <SkeletonList count={3} />
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-fade-in">

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
            Sua plataforma de inteligência jurídica está pronta.
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
              <span className={`font-display font-bold text-2xl sm:text-3xl ${color}`}>{value}</span>
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

        {processos.length === 0 ? (
          <div className="p-6 sm:p-10">
            <div className="max-w-xl mx-auto text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={26} className="text-brand-indigo" />
              </div>
              <h3 className="font-display font-bold text-brand-cream text-lg mb-1">Bem-vindo à IURISPRUDENTIA</h3>
              <p className="font-body text-brand-slate text-sm">Siga os 3 passos abaixo para gerar seu primeiro parecer com IA.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Upload,    step: '1', title: 'Crie um processo', desc: 'Preencha os dados e faça upload do PDF da peça processual.' },
                { icon: Sparkles,  step: '2', title: 'Analise com IA',   desc: 'Clique em "Analisar com IURISPRUDENTIA" — buscamos jurisprudência, CF/88 e CP em segundos.' },
                { icon: PenLine,   step: '3', title: 'Revise e aprove',  desc: 'Insira as sugestões no editor, ajuste o texto e aprove o parecer.' },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="card p-5 space-y-3 border border-brand-indigo/10">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-brand-indigo/20 text-brand-indigo text-xs font-bold flex items-center justify-center flex-shrink-0">{step}</span>
                    <Icon size={16} className="text-brand-indigo" />
                  </div>
                  <p className="font-body font-semibold text-brand-cream text-sm">{title}</p>
                  <p className="font-body text-brand-slate text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="/dashboard/processos" className="btn-primary inline-flex">
                <Plus size={14} />
                Criar primeiro processo
              </Link>
            </div>
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
                    {p.numero || 'Número pendente'}
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
