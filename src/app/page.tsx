'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Logo from '@/components/ui/Logo'
import { Eye, EyeOff, ArrowRight, Scale, Shield, BookOpen, BarChart3, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PlanId } from '@/lib/plans'

/* ─── Animated stat counter ─────────────── */
function AnimatedStat({ value, suffix = '' }: { value: string; suffix?: string }) {
  return (
    <span className="font-display font-bold text-brand-gold text-3xl xl:text-4xl tabular-nums">
      {value}
      <span className="text-brand-gold/70">{suffix}</span>
    </span>
  )
}

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
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
      <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-navy flex flex-col lg:flex-row">

      {/* ════════════════════════════════════════════════════ */}
      {/* LEFT PANEL - Hero / Branding (hidden mobile)       */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">

        {/* Marble background image */}
        <div className="absolute inset-0">
          <img
            src="/images/legal-hero.jpg"
            alt=""
            className="w-full h-full object-cover"
          />
          {/* Overlay for readability */}
          <div className="absolute inset-0 bg-brand-navy/75" />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-navy/90 via-brand-navy/60 to-brand-navy/80" />
        </div>

        {/* Decorative gold line - top */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 2xl:p-16 w-full">

          {/* Top - Logo */}
          <div
            className={`space-y-3 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
          >
            <Logo size="lg" href="/" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-[1px] bg-brand-gold/60" />
              <p className="text-brand-gold/80 font-body text-[11px] uppercase tracking-[0.25em] font-semibold">
                Inteligência Jurídica Aplicada
              </p>
            </div>
          </div>

          {/* Middle - Hero Copy */}
          <div
            className={`max-w-xl space-y-10 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <div className="space-y-5">
              <h1 className="font-display text-4xl xl:text-5xl 2xl:text-[3.4rem] font-bold text-brand-cream leading-[1.15] text-balance">
                Onde dados encontram o{' '}
                <span className="text-brand-gold italic">Direito.</span>
              </h1>
              <p className="font-body text-brand-slate text-base xl:text-lg leading-relaxed max-w-md">
                Analise jurisprudencial com inteligência artificial para fundamentar
                teses, mapear tendências e antecipar decisões com precisão.
              </p>
            </div>

            {/* Feature Pillars */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Scale, label: 'Pesquisa Inteligente', desc: 'Padrões e probabilidades extraídos de milhares de decisões' },
                { icon: Shield, label: 'Segurança Jurídica', desc: 'Fundamentação embasada em dados reais dos tribunais' },
                { icon: BookOpen, label: 'Base de Conhecimento', desc: 'Acervo curado de jurisprudência organizado por matéria' },
                { icon: BarChart3, label: 'Análise Estratégica', desc: 'Mapeamento por tribunal, câmara e julgador' },
              ].map(({ icon: Icon, label, desc }, i) => (
                <div
                  key={label}
                  className={`group p-4 rounded-xl border border-brand-border/50 bg-brand-navy/40 backdrop-blur-sm
                    hover:border-brand-gold/30 hover:bg-brand-navylt/50 transition-all duration-300
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${400 + i * 100}ms` }}
                >
                  <Icon size={18} className="text-brand-gold mb-2.5 group-hover:scale-110 transition-transform" />
                  <p className="font-body font-semibold text-brand-cream text-sm mb-1">{label}</p>
                  <p className="font-body text-brand-slate text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div
              className={`flex items-center gap-8 xl:gap-12 pt-2 transition-all duration-700 delay-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {[
                { val: '50K', suf: '+', label: 'Decisões analisadas' },
                { val: '97', suf: '%', label: 'Precisão na pesquisa' },
                { val: '12', suf: '', label: 'Tribunais cobertos' },
              ].map(({ val, suf, label }) => (
                <div key={label} className="space-y-1">
                  <AnimatedStat value={val} suffix={suf} />
                  <p className="font-body text-brand-slate text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom - Footer & Trust */}
          <div
            className={`flex items-end justify-between transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          >
            <p className="font-body text-brand-slate/60 text-xs">
              &copy; {new Date().getFullYear()} IURISPRUDENTIA. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-1.5 text-brand-slate/50 text-xs font-body">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Plataforma segura
            </div>
          </div>
        </div>

        {/* Decorative gold line - bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent" />
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL - Auth Form                            */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[460px] xl:w-[480px] flex flex-col min-h-screen lg:min-h-0 bg-brand-navylt lg:border-l border-brand-border/60 relative">

        {/* Subtle top accent line */}
        <div className="lg:hidden h-[2px] bg-gradient-to-r from-brand-gold/0 via-brand-gold/50 to-brand-gold/0" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 lg:py-0">
          <div
            className={`w-full max-w-sm space-y-7 transition-all duration-600 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >

            {/* Mobile: Logo + Branding */}
            <div className="lg:hidden text-center space-y-3 pb-2">
              <Logo size="md" href="/" />
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-[1px] bg-brand-gold/50" />
                <p className="text-brand-gold/70 font-body text-[10px] uppercase tracking-[0.25em] font-semibold">
                Inteligência Jurídica
                </p>
                <div className="w-6 h-[1px] bg-brand-gold/50" />
              </div>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-[1px] bg-brand-gold/60" />
                <p className="text-brand-gold text-[10px] uppercase tracking-[0.22em] font-bold font-body">
                  Acesso profissional                </p>
              </div>
              <h2 className="font-display text-2xl font-bold text-brand-cream leading-tight">
                {mode === 'login' ? 'Entrar na plataforma' : 'Criar sua conta'}
              </h2>
              <p className="font-body text-brand-slate text-sm leading-relaxed">
                {mode === 'login'
                  ? 'Acesse seu ambiente institucional para continuar.'
                  : 'Inicie sua avaliação e conheça a inteligência jurídica da IURISPRUDENTIA.'}
              </p>
            </div>

            {/* Trial badge */}
            {mode === 'register' && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-brand-indigo/8 border border-brand-indigo/20">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-indigo animate-pulse flex-shrink-0" />
                <p className="font-body text-brand-indigo text-xs font-semibold">
                  Avaliação gratuita: 7 dias e 2 análises por dia
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="label">Nome completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Dr. Joao Silva"
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
                    <option value="free">Trial (7 dias, 2 documentos/dia)</option>
                    <option value="plano1">Starter (R$ 89,90)</option>
                    <option value="plano2">Pro (R$ 179,90)</option>
                    <option value="escritorio">Escritório (R$ 459,90)</option>
                    <option value="start">Enterprise (sob consulta)</option>
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
                    aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button type="button" className="font-body text-brand-slate text-xs hover:text-brand-gold transition-colors">
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-gold text-brand-navy
                  font-body font-bold text-sm rounded-lg border border-brand-goldlt/30
                  hover:bg-brand-goldlt transition-all duration-200
                  shadow-gold hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0
                  disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-brand-navy/30 border-t-brand-navy rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-border/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-brand-navylt px-3 text-brand-slate/60 text-[11px] font-body uppercase tracking-wider">
                  ou continue com
                </span>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg
                border border-brand-border/60 bg-brand-navy/50
                text-brand-cream font-body text-sm font-semibold
                hover:border-brand-border hover:bg-brand-navy transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>

            {/* Toggle mode */}
            <p className="text-center font-body text-brand-slate text-sm">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-brand-gold hover:text-brand-goldlt font-semibold transition-colors"
              >
                {mode === 'login' ? 'Criar conta' : 'Fazer login'}
                <ChevronRight size={13} className="inline ml-0.5 -mt-0.5" />
              </button>
            </p>

            {/* Mobile: trust + footer */}
            <div className="lg:hidden space-y-4 pt-4">
              <div className="flex items-center justify-center gap-6 text-brand-slate/50">
                {[
                  { val: '50K+', label: 'Decisões' },
                  { val: '97%', label: 'Precisão' },
                  { val: '12', label: 'Tribunais' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center">
                    <p className="font-display font-bold text-brand-gold/80 text-lg">{val}</p>
                    <p className="font-body text-[10px] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
              <p className="font-body text-brand-slate/40 text-[10px] text-center">
                &copy; {new Date().getFullYear()} IURISPRUDENTIA. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
