'use client'
// src/app/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Logo from '@/components/ui/Logo'
import { Eye, EyeOff, ArrowRight, Scale, ShieldCheck, Radio, BriefcaseBusiness } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PlanId } from '@/lib/plans'

export default function HomePage() {
  const router = useRouter()
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('free')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        toast.success('Bem-vindo de volta!')
      } else {
        await signUp(email, password, name, selectedPlan)
        toast.success('Conta criada com sucesso!')
      }
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle(mode === 'register' ? selectedPlan : undefined)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Erro com Google.')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-navy bg-grid legal-hero-bg flex">

      {/* ── Left Panel: Hero ─────────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-brand-indigo/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl" />
        </div>

        {/* Top Left Identity */}
        <div className="relative z-10 space-y-3">
          <Logo size="lg" href="/" />
          <p className="text-brand-gold font-body text-sm uppercase tracking-widest font-semibold">
            Plataforma Jurídica para Escritórios e Advogados
          </p>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 w-full max-w-2xl mx-auto py-8 space-y-8 animate-slide-up">
          <div className="space-y-4">
            <h1 className="font-display text-5xl font-bold text-brand-cream leading-tight">
              Jurisprudência encontrada.<br />
              <span className="text-brand-indigo hero-accent-readable">Parecer fortalecido.</span>
            </h1>
            <p className="font-body text-brand-slate text-lg leading-relaxed">
              Jurisprudência confiável com arquitetura de IA avançada para entregar análise
              mais precisa, mantendo o controle técnico nas mãos do advogado.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Scale, label: 'Pesquisa de Precedentes', desc: 'Localização de julgados relevantes para o caso concreto.' },
              { icon: ShieldCheck, label: 'Integridade das Referências', desc: 'Preservação de números de processo, relatoria e tribunal sem distorções.' },
              { icon: Radio, label: 'Acompanhamento em Tempo Real', desc: 'Evolução da análise e justificativas exibidas à medida que são produzidas.' },
              { icon: BriefcaseBusiness, label: 'Confiança e Experiência', desc: 'A plataforma sugere o grau de confiança da jurisprudência, e sua vivência profissional consolida o parecer jurídico final.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 animate-slide-right">
                <div className="w-9 h-9 rounded-lg bg-brand-indigo/15 border border-brand-indigo/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-brand-indigo" />
                </div>
                <div>
                  <p className="font-body font-semibold text-brand-cream text-sm">{label}</p>
                  <p className="font-body text-brand-slate text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="legal-signal-panel">
            <p className="legal-signal-title">Matriz de apoio ao parecer</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="legal-signal-card">
                <p className="legal-signal-label">Confiança sugerida</p>
                <p className="legal-signal-value">Alta</p>
                <p className="legal-signal-text">Baseada na aderência entre fatos do processo e precedentes correlatos.</p>
              </div>
              <div className="legal-signal-card">
                <p className="legal-signal-label">Experiência do advogado</p>
                <p className="legal-signal-value">Essencial</p>
                <p className="legal-signal-text">A estratégia final permanece sob seu critério técnico e visão de causa.</p>
              </div>
            </div>
          </div>

          <div className="pricing-impact-panel">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="pricing-kicker">Posicionamento Comercial</p>
                <h3 className="pricing-title">Planos a partir de R$ 89,90</h3>
              </div>
              <p className="pricing-note">Sem fidelidade anual obrigatória</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { name: 'Plano 1', price: 'R$ 89,90', limits: '1 usuário · até 20 processos' },
                { name: 'Plano 2', price: 'R$ 179,90', limits: '1 usuário · até 70 processos' },
                { name: 'Plano 3 Escritório', price: 'R$ 459,90', limits: 'até 6 usuários · até 350 processos' },
                { name: 'Plano 4 Start Escritório', price: 'Sob consulta', limits: 'Entre em contato para alinhar o melhor plano' },
              ].map(plan => (
                <div key={plan.name} className="pricing-card">
                  <p className="pricing-card-name">{plan.name}</p>
                  <p className="pricing-card-price">{plan.price}</p>
                  <p className="pricing-card-limits">{plan.limits}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="font-body text-brand-slate text-xs relative z-10">
          © {new Date().getFullYear()} JurisprudencIA. Todos os direitos reservados.
        </p>
      </div>

      {/* ── Right Panel: Auth Form ────────────────────────── */}
      <div className="w-full lg:w-[500px] flex items-center justify-center p-8 bg-brand-navylt/95 border-l border-brand-border backdrop-blur-sm">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">

          {/* Mobile logo */}
          <div className="lg:hidden">
            <Logo size="md" href="/" />
          </div>

          <div>
            <p className="text-brand-gold text-xs uppercase tracking-[0.2em] font-semibold mb-3">
              Acesso profissional
            </p>
            <h2 className="font-display text-2xl font-bold text-brand-cream">
              {mode === 'login' ? 'Entrar na plataforma' : 'Criar sua conta'}
            </h2>
            <p className="font-body text-brand-slate text-sm mt-1">
              {mode === 'login'
                ? 'Acesse seu ambiente de trabalho para continuar.'
                : 'Comece sua avaliação com acesso completo.'}
            </p>
            <p className="font-body text-brand-indigo text-xs font-semibold mt-2">
              Free: 7 dias e 2 documentos por dia
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Nome completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Dr. João Silva"
                  className="input"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="label">Plano</label>
                <select
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value as PlanId)}
                  className="input"
                  required
                >
                  <option value="free">Free (7 dias, 2 documentos/dia)</option>
                  <option value="plano1">Plano 1 (R$ 89,90)</option>
                  <option value="plano2">Plano 2 (R$ 179,90)</option>
                  <option value="escritorio">Plano Escritório (R$ 459,90)</option>
                  <option value="start">Start Escritório (sob consulta)</option>
                </select>
              </div>
            )}

            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="joao@escritorio.adv.br"
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-slate hover:text-brand-cream transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center py-3"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="divider" />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-navylt px-3 text-brand-slate text-xs">
              ou continue com
            </span>
          </div>

          <button
            onClick={handleGoogle}
            className="btn-ghost w-full justify-center border-brand-border py-3 font-semibold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>

          <p className="text-center font-body text-brand-slate text-sm">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-brand-indigo hover:text-brand-indigolt font-semibold transition-colors"
            >
              {mode === 'login' ? 'Criar conta' : 'Fazer login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
