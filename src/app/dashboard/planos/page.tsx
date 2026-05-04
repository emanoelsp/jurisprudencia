'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { PLAN_POLICIES, PlanId, normalizePlan } from '@/lib/plans'
import { Crown, Loader2, ShieldCheck, Rocket, Check, X } from 'lucide-react'
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
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
          const histLabel = plan.limits.versionHistoryDays === -1 ? 'Ilimitado' : plan.limits.versionHistoryDays === 0 ? '—' : `${plan.limits.versionHistoryDays} dias`
          const batchLabel = plan.limits.batchSize === 0 ? null : plan.limits.batchSize > 50 ? 'Ilimitado' : `${plan.limits.batchSize} processos`
          return (
            <div
              key={planId}
              className={`card p-5 flex flex-col gap-4 relative ${active ? 'border-brand-indigo/40 bg-brand-indigo/10' : ''}`}
            >
              {active && (
                <span className="absolute top-3 right-3 text-[10px] font-bold text-brand-indigo bg-brand-indigo/10 border border-brand-indigo/30 rounded-full px-2 py-0.5">
                  Atual
                </span>
              )}
              <div className="space-y-1">
                <p className="font-display text-lg text-brand-cream font-bold">{plan.name}</p>
                <p className="text-brand-gold font-semibold text-sm">{plan.priceLabel}</p>
              </div>

              <div className="text-xs text-brand-slate space-y-1 border-t border-brand-border pt-3">
                <p className="font-semibold text-brand-cream">{plan.limits.docsPerDay} docs/dia</p>
                <p>{plan.limits.maxUsers} usuário{plan.limits.maxUsers > 1 ? 's' : ''}</p>
                <p>Até {plan.limits.maxProcesses.toLocaleString('pt-BR')} processos</p>
              </div>

              <div className="space-y-1.5 border-t border-brand-border pt-3">
                {[
                  { label: 'Export PDF/Word',     ok: plan.limits.allowExport },
                  { label: 'Expandir tribunais',   ok: plan.limits.allowExpandTribunais },
                  { label: 'Análise em lote',      ok: plan.limits.allowBatchAnalysis, detail: batchLabel },
                  { label: 'Templates custom',     ok: plan.limits.allowCustomTemplates },
                  { label: 'Log de auditoria',     ok: plan.limits.allowAuditLog },
                  { label: 'White-label',          ok: plan.limits.allowWhiteLabel },
                  { label: 'Acesso à API',         ok: plan.limits.allowApiAccess },
                  { label: `Histórico`,            ok: true, detail: histLabel },
                ].map(({ label, ok, detail }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs">
                    {ok
                      ? <Check size={11} className="text-emerald-400 flex-shrink-0" />
                      : <X size={11} className="text-brand-border flex-shrink-0" />
                    }
                    <span className={ok ? 'text-brand-slate' : 'text-brand-border'}>
                      {label}{detail ? ` (${detail})` : ''}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-2">
                {active ? (
                  <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 w-full justify-center">
                    <Crown size={12} /> Plano atual
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckout(planId)}
                    disabled={!!loadingPlan || planId === 'free'}
                    className={`w-full justify-center text-xs py-2 ${planId === 'start' ? 'btn-gold' : 'btn-primary'} ${planId === 'free' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {loadingPlan === planId ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
                    {planId === 'start' ? 'Falar com vendas' : planId === 'free' ? 'Plano atual' : 'Fazer upgrade'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card p-4 sm:p-5 border-brand-indigo/20">
        <p className="text-sm text-brand-cream font-semibold mb-2">Comparativo rápido</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-brand-slate">
          <div><span className="text-brand-cream font-semibold">Trial → Starter:</span> Export PDF/Word, histórico 30 dias, expandir tribunais.</div>
          <div><span className="text-brand-cream font-semibold">Starter → Pro:</span> Análise em lote, templates, API, histórico 12 meses.</div>
          <div><span className="text-brand-cream font-semibold">Pro → Escritório:</span> 6 usuários, auditoria, white-label, histórico ilimitado.</div>
          <div><span className="text-brand-cream font-semibold">Escritório → Enterprise:</span> Integrações (e-proc, SAJ, PJe), success manager, lote ilimitado.</div>
        </div>
      </div>
    </div>
  )
}
