'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { PLAN_POLICIES, PlanId, normalizePlan } from '@/lib/plans'
import { Crown, Loader2, ShieldCheck, Rocket } from 'lucide-react'
import toast from 'react-hot-toast'

const ORDER: PlanId[] = ['free', 'plano1', 'plano2', 'escritorio', 'start']

export default function PlanosPage() {
  const { user, userData } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const activePlan = normalizePlan(userData?.plano)
  const daysLeft = useMemo(() => {
    if (!userData?.trialEndsAt) return null
    const ms = new Date(userData.trialEndsAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  }, [userData?.trialEndsAt])

  async function handleCheckout(plan: PlanId) {
    if (!user) return
    if (plan === 'start') {
      toast('Para Start Escritorio, entre em contato comercial.')
      return
    }
    if (plan === 'free') return
    setLoadingPlan(plan)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar pagamento')
      const checkoutUrl = data.init_point || data.sandbox_init_point
      if (!checkoutUrl) throw new Error('Checkout indisponivel')
      window.location.href = checkoutUrl
    } catch (err: any) {
      toast.error(err.message || 'Falha no checkout')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title text-xl sm:text-2xl">Planos e Upgrade</h1>
        <p className="font-body text-brand-slate text-sm mt-1">
          Plano atual: <span className="text-brand-cream font-semibold">{PLAN_POLICIES[activePlan].name}</span>
          {activePlan === 'free' && (
            <span> -- {daysLeft ?? 0} dias restantes no free</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {ORDER.map(planId => {
          const plan = PLAN_POLICIES[planId]
          const active = activePlan === planId
          return (
            <div
              key={planId}
              className={`card p-5 flex flex-col gap-4 ${active ? 'border-brand-indigo/40 bg-brand-indigo/10' : ''}`}
            >
              <div className="space-y-1">
                <p className="font-display text-lg text-brand-cream font-bold">{plan.name}</p>
                <p className="text-brand-gold font-semibold">{plan.priceLabel}</p>
              </div>

              <div className="text-xs text-brand-slate space-y-1">
                <p>{plan.limits.docsPerDay} documentos por dia</p>
                <p>{plan.limits.maxUsers} usuario(s)</p>
                <p>Ate {plan.limits.maxProcesses} processos</p>
              </div>

              <div className="space-y-1">
                {plan.perks.map(perk => (
                  <div key={perk} className="flex items-start gap-1.5 text-xs text-brand-slate">
                    <ShieldCheck size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto">
                {active ? (
                  <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Crown size={12} />
                    Plano atual
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout(planId)}
                    disabled={loadingPlan === planId}
                    className="btn-primary w-full justify-center"
                  >
                    {loadingPlan === planId ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                    {planId === 'start' ? 'Falar com vendas' : 'Fazer upgrade'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card p-4 sm:p-5">
        <p className="text-sm text-brand-cream font-semibold">Vantagens exclusivas dos planos pagos</p>
        <p className="text-xs text-brand-slate mt-1 leading-relaxed">
          Expandir tribunais, rerank avancado, fila prioritaria e maior volume diario. O plano Trial nao inclui esses recursos.
        </p>
      </div>
    </div>
  )
}
