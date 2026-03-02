'use client'
// src/app/dashboard/layout.tsx
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { normalizePlan, planForUserPlan, todayDateKey } from '@/lib/plans'
import Logo from '@/components/ui/Logo'
import {
  LayoutDashboard, FileText, BookOpen,
  LogOut, Settings, ChevronRight, Crown, WalletCards,
  Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const nav = [
  { href: '/dashboard',                     icon: LayoutDashboard, label: 'Visão Geral' },
  { href: '/dashboard/processos',           icon: FileText,        label: 'Processos' },
  { href: '/dashboard/base-conhecimento',   icon: BookOpen,        label: 'Base de Conhecimento' },
  { href: '/dashboard/planos',              icon: WalletCards,     label: 'Planos' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, signOut } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function handleSignOut() {
    await signOut()
    toast.success('Até logo!')
    router.replace('/')
  }

  function planLabel(raw?: string) {
    return planForUserPlan(normalizePlan(raw))?.name ?? 'Trial'
  }

  function freeDaysLeft(trialEndsAt?: string) {
    if (!trialEndsAt) return null
    const ms = new Date(trialEndsAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  }

  if (loading || !user) return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-brand-border flex items-center justify-between">
        <Logo size="sm" />
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-brand-slate hover:text-brand-cream transition-colors p-1"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-brand-indigo/15 text-brand-cream border border-brand-indigo/25'
                  : 'text-brand-slate hover:text-brand-cream hover:bg-brand-navy border border-transparent',
              )}
            >
              <Icon size={18} className={active ? 'text-brand-indigo' : ''} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-brand-indigo" />}
            </Link>
          )
        })}
      </nav>

      {/* User block */}
      <div className="p-3 border-t border-brand-border space-y-2">
        {(normalizePlan(userData?.plano) === 'free') && (
          <button
            onClick={() => router.push('/dashboard/planos')}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-gold/10 border border-brand-gold/25 rounded-lg hover:bg-brand-gold/15 transition-colors"
          >
            <Crown size={14} className="text-brand-gold" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-brand-gold">Plano Trial</p>
              <p className="text-[11px] text-brand-slate truncate">
                {freeDaysLeft(userData?.trialEndsAt) ?? 0} dias restantes
              </p>
            </div>
          </button>
        )}

        {userData?.plano && normalizePlan(userData?.plano) !== 'free' && (
          <button
            onClick={() => router.push('/dashboard/planos')}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-indigo/10 border border-brand-indigo/25 rounded-lg hover:bg-brand-indigo/15 transition-colors"
          >
            <WalletCards size={14} className="text-brand-indigo" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-brand-cream">{planLabel(userData?.plano)}</p>
              {(() => {
                const plan = planForUserPlan(userData?.plano)
                const today = todayDateKey()
                const used = Number(userData?.usageCounters?.[today]?.processesCreated || 0)
                const max = plan?.limits?.docsPerDay ?? 30
                const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0
                return (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1.5 w-full bg-brand-navy rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-indigo transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-brand-slate truncate">
                      {used} / {max} documentos hoje
                    </p>
                  </div>
                )
              })()}
            </div>
          </button>
        )}

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-brand-navy/50">
          <div className="w-8 h-8 rounded-full bg-brand-indigo/20 border border-brand-indigo/30 flex items-center justify-center text-brand-indigo font-semibold text-xs flex-shrink-0">
            {(userData?.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-cream truncate">
              {userData?.displayName || 'Advogado'}
            </p>
            <p className="text-[11px] text-brand-slate truncate">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-1.5">
          <button className="btn-ghost flex-1 text-xs py-2 px-2 justify-center">
            <Settings size={14} />
            <span className="hidden sm:inline">Config</span>
          </button>
          <button onClick={handleSignOut} className="btn-ghost flex-1 text-xs py-2 px-2 justify-center">
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-brand-navy flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop: fixed, mobile: slide-in */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-brand-navylt border-r border-brand-border flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-brand-navylt border-b border-brand-border flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-brand-slate hover:text-brand-cream transition-colors p-1"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <Logo size="sm" />
          <div className="flex-1" />
          <div className="w-7 h-7 rounded-full bg-brand-indigo/20 border border-brand-indigo/30 flex items-center justify-center text-brand-indigo font-semibold text-[10px]">
            {(userData?.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-grid">
          {children}
        </main>
      </div>
    </div>
  )
}
