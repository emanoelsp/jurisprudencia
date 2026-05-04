'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  BarChart3, Users, DollarSign, Server,
  TrendingUp, TrendingDown, UserCheck, Wallet,
  Search, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, X,
  Activity, Database, RefreshCw, ExternalLink,
  CheckCircle, AlertCircle, AlertTriangle, Loader2,
  Zap, ScrollText, HeartPulse, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  uid: string
  email: string
  displayName: string
  role: string
  plano: string
  planoStatus: string
  trialEndsAt: string | null
  escritorio: string | null
  createdAt: string
  monthlyUsage: number
}

interface AdminExpense {
  id: string
  type: 'fixed' | 'variable'
  category: string
  name: string
  amount: number
  month: string
  userId?: string
  notes?: string
  createdAt: string
}

interface BillingData {
  month: string
  mrr: number
  mrrByPlan: Record<string, { count: number; revenue: number; active: number; trialing: number; canceled: number }>
  totalClients: number
  active: number
  trialing: number
  canceled: number
  expenses: AdminExpense[]
  totalExpenses: number
  fixedExpenses: number
  variableExpenses: number
  netRevenue: number
}

interface IngestResult {
  ok?: boolean; success?: boolean; dryRun?: boolean
  docsParsed?: number; vectorsPrepared?: number; resourcesAttempted?: number
  namespace?: string; durationMs?: number; error?: string
}

type Tab = 'overview' | 'clients' | 'financial' | 'infrastructure'

// ── Constants ────────────────────────────────────────────────────────────────

const PLAN_META: Record<string, { name: string; price: number; cls: string }> = {
  free:       { name: 'Trial',      price: 0,      cls: 'text-brand-slate border-brand-border bg-brand-navy/30' },
  plano1:     { name: 'Starter',    price: 89.90,  cls: 'text-brand-indigo border-brand-indigo/30 bg-brand-indigo/10' },
  plano2:     { name: 'Pro',        price: 179.90, cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  escritorio: { name: 'Escritório', price: 459.90, cls: 'text-brand-gold border-brand-gold/30 bg-brand-gold/10' },
  start:      { name: 'Enterprise', price: 0,      cls: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  trialing:  { label: 'Trial',        cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  active:    { label: 'Ativo',        cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  past_due:  { label: 'Inadimplente', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
  canceled:  { label: 'Cancelado',    cls: 'text-brand-slate border-brand-border bg-brand-navy/30' },
}

const SERVICE_SUGGESTIONS = [
  'Pinecone', 'Firebase', 'Vercel', 'Upstash Redis', 'Langfuse',
  'Gemini API', 'Cohere API', 'Groq API', 'OpenRouter',
  'Resend', 'Mercado Pago', 'Domínio/SSL', 'Outros',
]

const PLAN_ORDER = ['free', 'plano1', 'plano2', 'escritorio', 'start']

const EMPTY_FORM = { type: 'fixed', category: 'infrastructure', name: '', amount: '', userId: '', notes: '' }

// ── Helpers ──────────────────────────────────────────────────────────────────

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function dateStr(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, userData } = useAuth()
  const isAdmin = userData?.role === 'admin'

  const [tab, setTab] = useState<Tab>('overview')

  // ── Clients state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [planChangeUser, setPlanChangeUser] = useState<AdminUser | null>(null)
  const [newPlan, setNewPlan] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  // ── Financial state
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [showExpForm, setShowExpForm] = useState(false)
  const [editExpense, setEditExpense] = useState<AdminExpense | null>(null)
  const [expForm, setExpForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [savingExp, setSavingExp] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Infrastructure state
  const [ingestRunning, setIngestRunning] = useState(false)
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null)
  const [maxDocs, setMaxDocs] = useState(60)
  const [maxResources, setMaxResources] = useState(3)
  const [dryRun, setDryRun] = useState(false)
  // STF ingest
  const [stfRunning, setStfRunning] = useState(false)
  const [stfResult, setStfResult] = useState<IngestResult | null>(null)
  const [stfMaxDocs, setStfMaxDocs] = useState(60)
  const [stfDryRun, setStfDryRun] = useState(false)
  // Camada 3
  const [camada3Running, setCamada3Running] = useState(false)
  const [camada3Result, setCamada3Result] = useState<any | null>(null)
  const [camada3DryRun, setCamada3DryRun] = useState(false)
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [health, setHealth] = useState<any | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)

  // ── Data loaders ─────────────────────────────────────────────────────────

  async function getToken() { return user!.getIdToken() }

  async function loadUsers() {
    if (!user) return
    setUsersLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setUsers(data.users || [])
      else toast.error(data.error || 'Erro ao carregar clientes')
    } catch (e: any) { toast.error(e.message) }
    finally { setUsersLoading(false) }
  }

  async function loadBilling(m: string) {
    if (!user) return
    setBillingLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/billing?month=${m}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setBilling(data)
      else toast.error(data.error || 'Erro ao carregar financeiro')
    } catch (e: any) { toast.error(e.message) }
    finally { setBillingLoading(false) }
  }

  async function loadHealth() {
    if (!user) return
    setLoadingHealth(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/health', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setHealth(data)
    } catch { /* silent */ }
    finally { setLoadingHealth(false) }
  }

  async function loadAuditLog() {
    if (!user) return
    setLoadingAudit(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/audit-log?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setAuditEntries(data.entries || [])
      else toast.error(data.error || 'Erro ao carregar log')
    } catch (e: any) { toast.error(e.message) }
    finally { setLoadingAudit(false) }
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAdmin || !user) return
    if (tab === 'overview') { loadUsers(); loadBilling(month) }
    else if (tab === 'clients') loadUsers()
    else if (tab === 'financial') loadBilling(month)
    else if (tab === 'infrastructure') { loadHealth(); loadAuditLog() }
  }, [tab, isAdmin, user]) // eslint-disable-line

  useEffect(() => {
    if (!isAdmin || !user) return
    if (tab === 'financial' || tab === 'overview') loadBilling(month)
  }, [month]) // eslint-disable-line

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handlePlanSave() {
    if (!planChangeUser || !user) return
    setSavingUser(true)
    try {
      const token = await getToken()
      const body: any = { uid: planChangeUser.uid }
      if (newPlan) body.plano = newPlan
      if (newStatus) body.planoStatus = newStatus
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Cliente atualizado')
        setPlanChangeUser(null)
        loadUsers()
        if (billing) loadBilling(month)
      } else {
        toast.error(data.error || 'Erro ao atualizar')
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingUser(false) }
  }

  function openExpForm(exp?: AdminExpense) {
    if (exp) {
      setEditExpense(exp)
      setExpForm({
        type: exp.type,
        category: exp.category,
        name: exp.name,
        amount: String(exp.amount),
        userId: exp.userId || '',
        notes: exp.notes || '',
      })
    } else {
      setEditExpense(null)
      setExpForm({ ...EMPTY_FORM, type: 'fixed' })
    }
    setShowExpForm(true)
  }

  async function submitExpense() {
    if (!expForm.name || !expForm.amount) return toast.error('Nome e valor são obrigatórios')
    const amount = parseFloat(expForm.amount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return toast.error('Valor inválido')
    setSavingExp(true)
    try {
      const token = await getToken()
      const body = { ...expForm, amount, month, ...(editExpense ? { id: editExpense.id } : {}) }
      const res = await fetch('/api/admin/expenses', {
        method: editExpense ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editExpense ? 'Despesa atualizada' : 'Despesa adicionada')
        setShowExpForm(false)
        loadBilling(month)
      } else {
        toast.error(data.error || 'Erro ao salvar')
      }
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingExp(false) }
  }

  async function deleteExpense(id: string) {
    setDeletingId(id)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/expenses?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { toast.success('Despesa removida'); loadBilling(month) }
      else toast.error('Erro ao remover')
    } catch (e: any) { toast.error(e.message) }
    finally { setDeletingId(null) }
  }

  async function runStjIngest() {
    setIngestRunning(true)
    setIngestResult(null)
    const t0 = Date.now()
    try {
      const token = await user?.getIdToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/admin/stj-ckan-ingest', {
        method: 'POST', headers,
        body: JSON.stringify({ maxDocs, maxResources, dryRun }),
      })
      const data = await res.json()
      setIngestResult({ ...data, ok: res.ok, durationMs: Date.now() - t0 })
      if (res.ok) toast.success(dryRun ? 'Dry run concluído.' : `${data.vectorsPrepared ?? 0} vetores indexados.`)
      else toast.error(data.error || 'Erro na ingestão.')
    } catch (e: any) {
      setIngestResult({ ok: false, error: e.message, durationMs: Date.now() - t0 })
      toast.error(e.message)
    } finally { setIngestRunning(false) }
  }

  async function runStfIngest() {
    setStfRunning(true)
    setStfResult(null)
    const t0 = Date.now()
    try {
      const token = await user?.getIdToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/admin/stf-ingest', {
        method: 'POST', headers,
        body: JSON.stringify({ maxDocs: stfMaxDocs, dryRun: stfDryRun }),
      })
      const data = await res.json()
      setStfResult({ ...data, ok: res.ok, durationMs: Date.now() - t0 })
      if (res.ok) toast.success(stfDryRun ? 'Dry run STF concluído.' : `${data.vectorsPrepared ?? 0} vetores STF indexados.`)
      else toast.error(data.error || 'Erro na ingestão STF.')
    } catch (e: any) {
      setStfResult({ ok: false, error: e.message, durationMs: Date.now() - t0 })
      toast.error(e.message)
    } finally { setStfRunning(false) }
  }

  async function runCamada3Ingest() {
    setCamada3Running(true)
    setCamada3Result(null)
    const t0 = Date.now()
    try {
      const token = await user?.getIdToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/admin/lexml-batch-ingest', {
        method: 'POST', headers,
        body: JSON.stringify({ dryRun: camada3DryRun }),
      })
      const data = await res.json()
      setCamada3Result({ ...data, ok: res.ok, durationMs: Date.now() - t0 })
      if (res.ok) toast.success(camada3DryRun ? 'Dry run Camada 3 concluído.' : `${data.totalVectors ?? 0} vetores indexados (${data.total ?? 0} leis).`)
      else toast.error(data.error || 'Erro na ingestão Camada 3.')
    } catch (e: any) {
      setCamada3Result({ ok: false, error: e.message, durationMs: Date.now() - t0 })
      toast.error(e.message)
    } finally { setCamada3Running(false) }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredUsers = users.filter(u => {
    const matchesPlan = !planFilter || u.plano === planFilter
    const q = search.toLowerCase()
    const matchesSearch = !search ||
      u.email.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q)
    return matchesPlan && matchesSearch
  })

  const topUsers = [...users].sort((a, b) => b.monthlyUsage - a.monthlyUsage).slice(0, 5)

  // ── Access guard ──────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-brand-slate text-sm">Acesso restrito.</p>
      </div>
    )
  }

  // ── Small shared UI pieces ────────────────────────────────────────────────

  const PlanBadge = ({ plano }: { plano: string }) => {
    const m = PLAN_META[plano] || PLAN_META.free
    return (
      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${m.cls}`}>
        {m.name}
      </span>
    )
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const m = STATUS_META[status] || STATUS_META.active
    return (
      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${m.cls}`}>
        {m.label}
      </span>
    )
  }

  const SectionTitle = ({ icon: Icon, title, extra }: { icon: any; title: string; extra?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-brand-gold" />
        <h2 className="font-body font-semibold text-brand-cream text-sm">{title}</h2>
      </div>
      {extra}
    </div>
  )

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-indigo/15 border border-brand-indigo/25 flex items-center justify-center">
          <Zap size={18} className="text-brand-indigo" />
        </div>
        <div>
          <h1 className="font-display font-bold text-brand-cream text-lg">Backoffice Admin</h1>
          <p className="font-body text-brand-slate text-xs">Gestão total da plataforma.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-brand-border overflow-x-auto">
        {([
          { id: 'overview',        label: 'Visão Geral',   Icon: BarChart3 },
          { id: 'clients',         label: 'Clientes',       Icon: Users },
          { id: 'financial',       label: 'Financeiro',     Icon: DollarSign },
          { id: 'infrastructure',  label: 'Infraestrutura', Icon: Server },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-body font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === id
                ? 'border-brand-indigo text-brand-cream'
                : 'border-transparent text-brand-slate hover:text-brand-cream hover:border-brand-border'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TAB: VISÃO GERAL ══════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'MRR',
                value: billing ? brl(billing.mrr) : '—',
                sub: monthLabel(month),
                icon: TrendingUp,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10 border-emerald-500/20',
              },
              {
                label: 'Clientes Ativos',
                value: billing ? String(billing.active) : '—',
                sub: `de ${billing?.totalClients ?? '—'} total`,
                icon: UserCheck,
                color: 'text-brand-indigo',
                bg: 'bg-brand-indigo/10 border-brand-indigo/20',
              },
              {
                label: 'Em Trial',
                value: billing ? String(billing.trialing) : '—',
                sub: billing && billing.totalClients > 0
                  ? `${Math.round((billing.trialing / billing.totalClients) * 100)}% da base`
                  : '',
                icon: Clock,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
              },
              {
                label: 'Resultado Líquido',
                value: billing ? brl(billing.netRevenue) : '—',
                sub: billing && billing.mrr > 0
                  ? `${Math.round((billing.netRevenue / billing.mrr) * 100)}% margem`
                  : 'após despesas',
                icon: billing && billing.netRevenue >= 0 ? Wallet : TrendingDown,
                color: billing && billing.netRevenue < 0 ? 'text-red-400' : 'text-brand-gold',
                bg: billing && billing.netRevenue < 0
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-brand-gold/10 border-brand-gold/20',
              },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className={`card p-4 border ${bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-body text-[10px] text-brand-slate uppercase tracking-wider">{label}</p>
                    <p className={`font-display font-bold text-xl mt-0.5 ${color}`}>{value}</p>
                    <p className="font-body text-[10px] text-brand-slate/70 mt-0.5">{sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${bg}`}>
                    <Icon size={16} className={color} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Plan Distribution */}
          <div className="card p-5">
            <SectionTitle icon={BarChart3} title="Distribuição por Plano" />
            {billingLoading ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-brand-slate" />
              </div>
            ) : billing ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-brand-border">
                      {['Plano', 'Total', 'Ativos', 'Trial', 'Cancelados', 'MRR'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {PLAN_ORDER.filter(p => billing.mrrByPlan[p]).map(p => {
                      const stat = billing.mrrByPlan[p]
                      return (
                        <tr key={p} className="hover:bg-brand-navy/30 transition-colors">
                          <td className="px-3 py-2.5"><PlanBadge plano={p} /></td>
                          <td className="px-3 py-2.5 font-mono text-brand-cream">{stat.count}</td>
                          <td className="px-3 py-2.5 font-mono text-emerald-400">{stat.active}</td>
                          <td className="px-3 py-2.5 font-mono text-amber-400">{stat.trialing}</td>
                          <td className="px-3 py-2.5 font-mono text-brand-slate">{stat.canceled}</td>
                          <td className="px-3 py-2.5 font-mono text-brand-cream font-semibold">{brl(stat.revenue)}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-brand-border bg-brand-navylt/30">
                      <td className="px-3 py-2.5 font-semibold text-brand-cream text-[10px] uppercase tracking-wider">Total</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand-cream">{billing.totalClients}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">{billing.active}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-amber-400">{billing.trialing}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand-slate">{billing.canceled}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand-gold">{brl(billing.mrr)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-brand-slate text-xs">Carregando...</p>
            )}
          </div>

          {/* Top Usage */}
          {topUsers.length > 0 && (
            <div className="card p-5">
              <SectionTitle icon={Activity} title="Maior Uso — Mês Atual" />
              <div className="space-y-2">
                {topUsers.map((u, i) => (
                  <div key={u.uid} className="flex items-center gap-3 py-1.5">
                    <span className="font-mono text-[10px] text-brand-slate/50 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs text-brand-cream truncate">{u.email}</p>
                      <p className="font-body text-[10px] text-brand-slate truncate">{u.displayName}</p>
                    </div>
                    <PlanBadge plano={u.plano} />
                    <span className="font-mono text-xs text-brand-indigo font-semibold w-12 text-right">
                      {u.monthlyUsage} <span className="text-brand-slate font-normal text-[10px]">análises</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB: CLIENTES ═════════════════════════════ */}
      {tab === 'clients' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-slate/50" />
              <input
                type="text"
                placeholder="Buscar por e-mail ou nome…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-8 text-xs py-2 w-full"
              />
            </div>
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="input text-xs py-2 w-full sm:w-40"
            >
              <option value="">Todos os planos</option>
              {PLAN_ORDER.map(p => (
                <option key={p} value={p}>{PLAN_META[p]?.name || p}</option>
              ))}
            </select>
            <button onClick={loadUsers} disabled={usersLoading} className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5">
              {usersLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Atualizar
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-navylt/40">
                    {['Cliente', 'Plano', 'Status', 'Uso / mês', 'Cadastro', 'Ações'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {usersLoading && users.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-brand-slate">
                      <Loader2 size={18} className="animate-spin mx-auto" />
                    </td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-brand-slate">Nenhum cliente encontrado.</td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-brand-navy/30 transition-colors">
                      <td className="px-3 py-3">
                        <p className="text-brand-cream truncate max-w-[180px]">{u.email}</p>
                        {u.displayName && (
                          <p className="text-brand-slate/70 text-[10px] truncate max-w-[180px]">{u.displayName}</p>
                        )}
                        {u.role === 'admin' && (
                          <span className="text-[9px] text-purple-400 font-semibold uppercase tracking-wider">admin</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><PlanBadge plano={u.plano} /></td>
                      <td className="px-3 py-3">
                        <StatusBadge status={u.planoStatus} />
                        {u.trialEndsAt && (
                          <p className="text-[9px] text-brand-slate/60 mt-0.5">até {dateStr(u.trialEndsAt)}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-brand-indigo font-semibold">
                        {u.monthlyUsage}
                        <span className="text-brand-slate font-normal text-[10px] ml-0.5">análises</span>
                      </td>
                      <td className="px-3 py-3 text-brand-slate whitespace-nowrap">{dateStr(u.createdAt)}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => { setPlanChangeUser(u); setNewPlan(u.plano); setNewStatus(u.planoStatus) }}
                          className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1"
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length > 0 && (
              <div className="px-3 py-2 border-t border-brand-border bg-brand-navylt/20">
                <p className="text-[10px] text-brand-slate/60 font-mono">
                  {filteredUsers.length} cliente{filteredUsers.length !== 1 ? 's' : ''} exibido{filteredUsers.length !== 1 ? 's' : ''}
                  {users.length !== filteredUsers.length && ` de ${users.length} total`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB: FINANCEIRO ═══════════════════════════ */}
      {tab === 'financial' && (
        <div className="space-y-5">

          {/* Month Navigator */}
          <div className="flex items-center justify-between card p-3 px-4">
            <button
              onClick={() => setMonth(m => shiftMonth(m, -1))}
              className="btn-ghost p-1.5 rounded-lg"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              {billingLoading && <Loader2 size={13} className="animate-spin text-brand-slate" />}
              <span className="font-display font-semibold text-brand-cream text-sm">{monthLabel(month)}</span>
            </div>
            <button
              onClick={() => setMonth(m => shiftMonth(m, 1))}
              className="btn-ghost p-1.5 rounded-lg"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Revenue Table */}
          <div className="card p-5">
            <SectionTitle
              icon={TrendingUp}
              title="Receita (Entradas)"
              extra={
                <span className="font-display font-bold text-emerald-400 text-base">
                  {billing ? brl(billing.mrr) : '—'}
                </span>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-brand-border">
                    {['Plano', 'Preço', 'Ativos', 'Trial', 'Cancelados', 'MRR'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {billing && PLAN_ORDER.filter(p => billing.mrrByPlan[p]).map(p => {
                    const stat = billing.mrrByPlan[p]
                    const meta = PLAN_META[p]
                    return (
                      <tr key={p} className="hover:bg-brand-navy/30">
                        <td className="px-3 py-2.5"><PlanBadge plano={p} /></td>
                        <td className="px-3 py-2.5 font-mono text-brand-slate">
                          {meta.price > 0 ? brl(meta.price) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-emerald-400">{stat.active}</td>
                        <td className="px-3 py-2.5 font-mono text-amber-400">{stat.trialing}</td>
                        <td className="px-3 py-2.5 font-mono text-brand-slate">{stat.canceled}</td>
                        <td className="px-3 py-2.5 font-mono text-brand-cream font-semibold">{brl(stat.revenue)}</td>
                      </tr>
                    )
                  })}
                  {!billing && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-brand-slate">
                      <Loader2 size={14} className="animate-spin mx-auto" />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fixed Expenses */}
          <div className="card p-5">
            <SectionTitle
              icon={Database}
              title="Despesas Fixas"
              extra={
                <div className="flex items-center gap-3">
                  {billing && (
                    <span className="font-mono text-xs text-red-400 font-semibold">
                      {brl(billing.fixedExpenses)}
                    </span>
                  )}
                  <button
                    onClick={() => { setExpForm({ ...EMPTY_FORM, type: 'fixed' }); setEditExpense(null); setShowExpForm(true) }}
                    className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
              }
            />
            <ExpenseTable
              expenses={(billing?.expenses || []).filter(e => e.type === 'fixed')}
              loading={billingLoading && !billing}
              onEdit={openExpForm}
              onDelete={deleteExpense}
              deletingId={deletingId}
              showClient={false}
            />
          </div>

          {/* Variable Expenses */}
          <div className="card p-5">
            <SectionTitle
              icon={Activity}
              title="Despesas Variáveis por Cliente"
              extra={
                <div className="flex items-center gap-3">
                  {billing && (
                    <span className="font-mono text-xs text-red-400 font-semibold">
                      {brl(billing.variableExpenses)}
                    </span>
                  )}
                  <button
                    onClick={() => { setExpForm({ ...EMPTY_FORM, type: 'variable' }); setEditExpense(null); setShowExpForm(true) }}
                    className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
              }
            />
            <ExpenseTable
              expenses={(billing?.expenses || []).filter(e => e.type === 'variable')}
              loading={billingLoading && !billing}
              onEdit={openExpForm}
              onDelete={deleteExpense}
              deletingId={deletingId}
              showClient
              users={users}
            />
          </div>

          {/* P&L Summary */}
          {billing && (
            <div className="card p-5 border border-brand-indigo/20 bg-brand-indigo/5">
              <SectionTitle icon={Wallet} title="Resultado do Mês" />
              <div className="space-y-2">
                {[
                  { label: 'Entradas (MRR)',        value: billing.mrr,             color: 'text-emerald-400',  sign: '' },
                  { label: 'Despesas Fixas',         value: billing.fixedExpenses,   color: 'text-red-400',      sign: '−' },
                  { label: 'Despesas Variáveis',     value: billing.variableExpenses,color: 'text-red-400',      sign: '−' },
                ].map(({ label, value, color, sign }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-brand-border/50">
                    <span className="font-body text-brand-slate text-xs">{label}</span>
                    <span className={`font-mono text-sm font-semibold ${color}`}>
                      {sign}{brl(value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-body font-semibold text-brand-cream text-sm">Resultado Líquido</span>
                  <div className="text-right">
                    <span className={`font-display font-bold text-xl ${billing.netRevenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {brl(billing.netRevenue)}
                    </span>
                    {billing.mrr > 0 && (
                      <p className="text-[10px] text-brand-slate/70 font-mono">
                        {Math.round((billing.netRevenue / billing.mrr) * 100)}% margem
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB: INFRAESTRUTURA ═══════════════════════ */}
      {tab === 'infrastructure' && (
        <div className="space-y-5">

          {/* STJ CKAN */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-brand-gold" />
              <h2 className="font-body font-semibold text-brand-cream text-sm">Ingestão STJ CKAN</h2>
              <span className="ml-auto text-[10px] text-brand-slate font-mono bg-brand-navy/60 px-2 py-0.5 rounded-full border border-brand-border">
                Cron: seg 04:00 UTC
              </span>
            </div>
            <p className="font-body text-brand-slate text-xs">
              Baixa acordãos do STJ via CKAN, gera embeddings e indexa no Pinecone (namespace <code className="text-brand-indigo">jurisprudencia_publica</code>).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="label">Max documentos</span>
                <input type="number" min={1} max={200} value={maxDocs}
                  onChange={e => setMaxDocs(Number(e.target.value))} className="input text-xs py-1.5" />
              </label>
              <label className="space-y-1">
                <span className="label">Max recursos CKAN</span>
                <input type="number" min={1} max={10} value={maxResources}
                  onChange={e => setMaxResources(Number(e.target.value))} className="input text-xs py-1.5" />
              </label>
              <label className="flex items-center gap-2 pt-5 cursor-pointer">
                <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)}
                  className="accent-brand-indigo w-4 h-4" />
                <span className="font-body text-brand-slate text-xs">Dry run (sem upsert)</span>
              </label>
            </div>
            <button onClick={runStjIngest} disabled={ingestRunning} className="btn-gold text-xs py-2 px-4">
              {ingestRunning
                ? <><Loader2 size={14} className="animate-spin" /> Ingerindo…</>
                : <><RefreshCw size={14} /> Executar ingestão STJ</>}
            </button>
            {ingestResult && (
              <div className={`rounded-lg border p-4 space-y-2 ${ingestResult.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <div className="flex items-center gap-2">
                  {ingestResult.ok
                    ? <CheckCircle size={14} className="text-emerald-400" />
                    : <AlertCircle size={14} className="text-red-400" />}
                  <span className="font-body text-sm font-semibold text-brand-cream">
                    {ingestResult.ok ? (ingestResult.dryRun ? 'Dry run OK' : 'Ingestão concluída') : 'Erro'}
                  </span>
                  {ingestResult.durationMs && (
                    <span className="ml-auto font-mono text-[10px] text-brand-slate">
                      {(ingestResult.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {ingestResult.ok && !ingestResult.error && (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {[
                      { label: 'Recursos CKAN', value: ingestResult.resourcesAttempted },
                      { label: 'Documentos', value: ingestResult.docsParsed },
                      { label: 'Vetores', value: ingestResult.vectorsPrepared },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-brand-navy/60 rounded-md p-2 border border-brand-border">
                        <div className="text-[9px] text-brand-slate/70 uppercase tracking-wider">{label}</div>
                        <div className="text-brand-cream font-display font-bold text-base mt-0.5">{value ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {ingestResult.error && <p className="font-body text-red-300 text-xs">{ingestResult.error}</p>}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1 border-t border-brand-border">
              <Clock size={11} className="text-brand-slate/60" />
              <p className="font-body text-[10px] text-brand-slate/60">
                Cron automático toda segunda-feira às 04:00 UTC via <code>vercel.json</code>. Requer <code>CRON_SECRET</code>.
              </p>
            </div>
          </section>

          {/* STF DataJud */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-brand-gold" />
              <h2 className="font-body font-semibold text-brand-cream text-sm">Ingestão STF (DataJud CNJ)</h2>
              <span className="ml-auto text-[10px] text-brand-slate font-mono bg-brand-navy/60 px-2 py-0.5 rounded-full border border-brand-border">
                Cron: seg 05:00 UTC
              </span>
            </div>
            <p className="font-body text-brand-slate text-xs">
              Baixa acórdãos recentes do STF via DataJud CNJ, gera embeddings e indexa no Pinecone (namespace <code className="text-brand-indigo">jurisprudencia_publica</code>).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="label">Max documentos</span>
                <input type="number" min={1} max={100} value={stfMaxDocs}
                  onChange={e => setStfMaxDocs(Number(e.target.value))} className="input text-xs py-1.5" />
              </label>
              <label className="flex items-center gap-2 pt-5 cursor-pointer">
                <input type="checkbox" checked={stfDryRun} onChange={e => setStfDryRun(e.target.checked)}
                  className="accent-brand-indigo w-4 h-4" />
                <span className="font-body text-brand-slate text-xs">Dry run (sem upsert)</span>
              </label>
            </div>
            <button onClick={runStfIngest} disabled={stfRunning} className="btn-gold text-xs py-2 px-4">
              {stfRunning
                ? <><Loader2 size={14} className="animate-spin" /> Ingerindo STF…</>
                : <><RefreshCw size={14} /> Executar ingestão STF</>}
            </button>
            {stfResult && (
              <div className={`rounded-lg border p-4 space-y-2 ${stfResult.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <div className="flex items-center gap-2">
                  {stfResult.ok ? <CheckCircle size={14} className="text-emerald-400" /> : <AlertCircle size={14} className="text-red-400" />}
                  <span className="font-body text-sm font-semibold text-brand-cream">
                    {stfResult.ok ? (stfResult.dryRun ? 'Dry run OK' : 'Ingestão STF concluída') : 'Erro'}
                  </span>
                  {stfResult.durationMs && (
                    <span className="ml-auto font-mono text-[10px] text-brand-slate">{(stfResult.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
                {stfResult.ok && !stfResult.error && (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {[
                      { label: 'Baixados', value: (stfResult as any).docsFetched },
                      { label: 'Processados', value: (stfResult as any).docsParsed },
                      { label: 'Vetores', value: (stfResult as any).vectorsPrepared },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-brand-navy/60 rounded-md p-2 border border-brand-border">
                        <div className="text-[9px] text-brand-slate/70 uppercase tracking-wider">{label}</div>
                        <div className="text-brand-cream font-display font-bold text-base mt-0.5">{value ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {stfResult.error && <p className="font-body text-red-300 text-xs">{stfResult.error}</p>}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1 border-t border-brand-border">
              <Clock size={11} className="text-brand-slate/60" />
              <p className="font-body text-[10px] text-brand-slate/60">
                Cron automático toda segunda-feira às 05:00 UTC via <code>vercel.json</code>. Requer <code>CRON_SECRET</code> e <code>DATAJUD_API_KEY</code>.
              </p>
            </div>
          </section>

          {/* Camada 3 — Leis Históricas */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-emerald-400" />
              <h2 className="font-body font-semibold text-brand-cream text-sm">Camada 3 — Leis Curadas (LexML Histórico)</h2>
            </div>
            <p className="font-body text-brand-slate text-xs">
              Indexa as 10 leis mais frequentes no contencioso brasileiro (CP, CF/88, CDC, CLT, CC, CPC, CPP, LIA, Maria da Penha, ECA) com textos e datas de vigência no Pinecone (namespace <code className="text-brand-indigo">legislacao</code>). Operação idempotente.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={camada3DryRun} onChange={e => setCamada3DryRun(e.target.checked)}
                className="accent-brand-indigo w-4 h-4" />
              <span className="font-body text-brand-slate text-xs">Dry run (sem upsert)</span>
            </label>
            <button onClick={runCamada3Ingest} disabled={camada3Running} className="btn-primary text-xs py-2 px-4">
              {camada3Running
                ? <><Loader2 size={14} className="animate-spin" /> Indexando leis…</>
                : <><RefreshCw size={14} /> Indexar 10 leis curadas</>}
            </button>
            {camada3Result && (
              <div className={`rounded-lg border p-4 space-y-2 ${camada3Result.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <div className="flex items-center gap-2">
                  {camada3Result.ok ? <CheckCircle size={14} className="text-emerald-400" /> : <AlertCircle size={14} className="text-red-400" />}
                  <span className="font-body text-sm font-semibold text-brand-cream">
                    {camada3Result.ok ? (camada3Result.dryRun ? 'Dry run OK' : 'Leis indexadas') : 'Erro'}
                  </span>
                  {camada3Result.durationMs && (
                    <span className="ml-auto font-mono text-[10px] text-brand-slate">{(camada3Result.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
                {camada3Result.ok && (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {[
                      { label: 'Leis', value: camada3Result.total },
                      { label: 'Erros', value: camada3Result.errors },
                      { label: 'Vetores', value: camada3Result.totalVectors },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-brand-navy/60 rounded-md p-2 border border-brand-border">
                        <div className="text-[9px] text-brand-slate/70 uppercase tracking-wider">{label}</div>
                        <div className="text-brand-cream font-display font-bold text-base mt-0.5">{value ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {camada3Result.results && (
                  <div className="space-y-1 pt-1">
                    {camada3Result.results.map((r: any) => (
                      <div key={r.urn} className="flex items-center gap-2 text-xs">
                        {r.success
                          ? <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" />
                          : <AlertCircle size={11} className="text-red-400 flex-shrink-0" />}
                        <span className={r.success ? 'text-brand-slate' : 'text-red-300'}>{r.nome}</span>
                        {r.success && <span className="ml-auto font-mono text-[10px] text-brand-slate/60">{r.vectorsPrepared}v</span>}
                      </div>
                    ))}
                  </div>
                )}
                {camada3Result.error && <p className="font-body text-red-300 text-xs">{camada3Result.error}</p>}
              </div>
            )}
          </section>

          {/* Langfuse */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-brand-indigo" />
              <h2 className="font-body font-semibold text-brand-cream text-sm">Observabilidade — Langfuse</h2>
            </div>
            <p className="font-body text-brand-slate text-xs">
              Cada chamada ao <code>/api/analyze</code> gera um trace com <code>retrieval_confidence</code>, <code>evidence_coverage</code> e <code>generation_risk</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_HOST'].map(label => (
                <div key={label} className="bg-brand-navy/60 rounded-md px-3 py-2 border border-brand-border">
                  <code className="text-[10px] text-brand-slate truncate block">{label}</code>
                </div>
              ))}
            </div>
            <a href="https://cloud.langfuse.com" target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-2 px-3 w-fit">
              <ExternalLink size={13} /> Abrir Langfuse Dashboard
            </a>
          </section>

          {/* Redis */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-emerald-400" />
              <h2 className="font-body font-semibold text-brand-cream text-sm">Cache Redis — Upstash</h2>
            </div>
            <p className="font-body text-brand-slate text-xs">
              Cache L2 para embeddings (TTL 24h) — reduz chamadas à API Gemini e latência do pipeline.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'].map(label => (
                <div key={label} className="bg-brand-navy/60 rounded-md px-3 py-2 border border-brand-border">
                  <code className="text-[10px] text-brand-slate truncate block">{label}</code>
                </div>
              ))}
            </div>
            <a href="https://console.upstash.com" target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-2 px-3 w-fit">
              <ExternalLink size={13} /> Abrir Upstash Console
            </a>
          </section>

          {/* Health */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HeartPulse size={16} className={health?.errors > 0 ? 'text-red-400' : health?.warnings > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                <h2 className="font-body font-semibold text-brand-cream text-sm">Saúde das APIs</h2>
                {health && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                    health.errors > 0 ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                    health.warnings > 0 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  }`}>
                    {health.errors > 0 ? `${health.errors} erro(s)` : health.warnings > 0 ? `${health.warnings} aviso(s)` : 'Tudo OK'}
                  </span>
                )}
              </div>
              <button onClick={loadHealth} disabled={loadingHealth} className="btn-ghost text-xs py-1.5 px-2">
                {loadingHealth ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
            </div>
            {loadingHealth && !health ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1,2,3,4].map(i => <div key={i} className="h-12 bg-brand-border/30 rounded-lg animate-pulse" />)}
              </div>
            ) : health ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {health.services.map((s: any) => (
                  <div key={s.name} className={`flex items-start gap-2 p-3 rounded-lg border ${
                    s.status === 'ok'   ? 'border-emerald-500/20 bg-emerald-500/5' :
                    s.status === 'warn' ? 'border-amber-500/20 bg-amber-500/5' :
                    'border-red-500/20 bg-red-500/5'
                  }`}>
                    {s.status === 'ok'
                      ? <CheckCircle size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      : s.status === 'warn'
                      ? <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      : <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-body text-xs font-semibold text-brand-cream">{s.name}</p>
                      {s.detail && <p className="font-body text-[10px] text-brand-slate truncate">{s.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-brand-slate text-xs">Clique em atualizar para verificar.</p>
            )}
          </section>

          {/* Audit Log */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ScrollText size={16} className="text-brand-gold" />
                <h2 className="font-body font-semibold text-brand-cream text-sm">Log de Auditoria</h2>
              </div>
              <button onClick={loadAuditLog} disabled={loadingAudit} className="btn-ghost text-xs py-1.5 px-2">
                {loadingAudit ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
            </div>
            {auditEntries.length === 0 ? (
              <p className="font-body text-brand-slate text-xs py-4 text-center">
                {loadingAudit ? 'Carregando...' : 'Nenhum registro ainda.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-brand-border">
                      {['Usuário', 'Ação', 'Processo', 'Data'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {auditEntries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-brand-navy/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-brand-slate truncate max-w-[8rem]">{e.userId?.slice(0, 12)}…</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                            e.action === 'analysis_run'       ? 'text-brand-indigo border-brand-indigo/30 bg-brand-indigo/10' :
                            e.action === 'parecer_approved'   ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                            e.action === 'batch_analysis_run' ? 'text-brand-gold border-brand-gold/30 bg-brand-gold/10' :
                            'text-brand-slate border-brand-border bg-brand-navy/30'
                          }`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-brand-slate text-[10px] truncate max-w-[8rem]">
                          {e.processoNumero || e.processoId?.slice(0, 8) || '—'}
                        </td>
                        <td className="px-3 py-2 text-brand-slate whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════ MODAL: EDITAR CLIENTE ═════════════════════ */}
      {planChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-brand-cream text-base">Editar Cliente</h3>
              <button onClick={() => setPlanChangeUser(null)} className="btn-ghost p-1.5 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1">
              <p className="font-body text-brand-cream text-sm font-semibold">{planChangeUser.email}</p>
              {planChangeUser.displayName && (
                <p className="font-body text-brand-slate text-xs">{planChangeUser.displayName}</p>
              )}
            </div>
            <div className="space-y-3">
              <label className="space-y-1 block">
                <span className="label">Plano</span>
                <select value={newPlan} onChange={e => setNewPlan(e.target.value)} className="input text-xs py-2 w-full">
                  {PLAN_ORDER.map(p => (
                    <option key={p} value={p}>{PLAN_META[p]?.name || p}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="label">Status</span>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input text-xs py-2 w-full">
                  <option value="trialing">Trial</option>
                  <option value="active">Ativo</option>
                  <option value="past_due">Inadimplente</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPlanChangeUser(null)} className="btn-ghost text-xs py-2 px-4 flex-1">
                Cancelar
              </button>
              <button onClick={handlePlanSave} disabled={savingUser} className="btn-gold text-xs py-2 px-4 flex-1">
                {savingUser ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL: DESPESA ════════════════════════════ */}
      {showExpForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-brand-cream text-base">
                {editExpense ? 'Editar Despesa' : 'Nova Despesa'}
              </h3>
              <button onClick={() => setShowExpForm(false)} className="btn-ghost p-1.5 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Tipo */}
              <div className="flex gap-2">
                {(['fixed', 'variable'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setExpForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      expForm.type === t
                        ? 'border-brand-indigo bg-brand-indigo/15 text-brand-cream'
                        : 'border-brand-border text-brand-slate hover:text-brand-cream'
                    }`}
                  >
                    {t === 'fixed' ? 'Despesa Fixa' : 'Despesa Variável'}
                  </button>
                ))}
              </div>

              {/* Serviço */}
              <label className="space-y-1 block">
                <span className="label">Serviço / Nome</span>
                <input
                  list="services-list"
                  value={expForm.name}
                  onChange={e => setExpForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Pinecone, Gemini API…"
                  className="input text-xs py-2 w-full"
                />
                <datalist id="services-list">
                  {SERVICE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </label>

              {/* Valor */}
              <label className="space-y-1 block">
                <span className="label">Valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={expForm.amount}
                  onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                  className="input text-xs py-2 w-full font-mono"
                />
              </label>

              {/* Cliente (variável) */}
              {expForm.type === 'variable' && (
                <label className="space-y-1 block">
                  <span className="label">Cliente (e-mail ou UID) — opcional</span>
                  <input
                    list="users-list"
                    value={expForm.userId}
                    onChange={e => setExpForm(f => ({ ...f, userId: e.target.value }))}
                    placeholder="cliente@email.com"
                    className="input text-xs py-2 w-full"
                  />
                  <datalist id="users-list">
                    {users.map(u => <option key={u.uid} value={u.email} />)}
                  </datalist>
                </label>
              )}

              {/* Observações */}
              <label className="space-y-1 block">
                <span className="label">Observações — opcional</span>
                <textarea
                  value={expForm.notes}
                  onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Detalhes adicionais…"
                  className="input text-xs py-2 w-full resize-none"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowExpForm(false)} className="btn-ghost text-xs py-2 px-4 flex-1">
                Cancelar
              </button>
              <button onClick={submitExpense} disabled={savingExp} className="btn-gold text-xs py-2 px-4 flex-1">
                {savingExp ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Expense Table sub-component ───────────────────────────────────────────────

function ExpenseTable({
  expenses, loading, onEdit, onDelete, deletingId, showClient, users = [],
}: {
  expenses: AdminExpense[]
  loading: boolean
  onEdit: (e: AdminExpense) => void
  onDelete: (id: string) => void
  deletingId: string | null
  showClient: boolean
  users?: AdminUser[]
}) {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) {
    return <div className="py-6 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-brand-slate" /></div>
  }

  if (expenses.length === 0) {
    return (
      <p className="text-brand-slate text-xs text-center py-4">
        Nenhuma despesa registrada.{' '}
        <span className="text-brand-slate/50">Clique em Adicionar para incluir.</span>
      </p>
    )
  }

  function clientLabel(userId?: string) {
    if (!userId) return '—'
    const u = users.find(u => u.uid === userId || u.email === userId)
    return u ? u.email : userId
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-brand-border">
            <th className="px-3 py-2 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">Serviço</th>
            {showClient && <th className="px-3 py-2 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">Cliente</th>}
            <th className="px-3 py-2 text-left font-semibold text-brand-slate uppercase tracking-wider text-[10px]">Observações</th>
            <th className="px-3 py-2 text-right font-semibold text-brand-slate uppercase tracking-wider text-[10px]">Valor</th>
            <th className="px-3 py-2 text-right font-semibold text-brand-slate uppercase tracking-wider text-[10px]">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border">
          {expenses.map(e => (
            <tr key={e.id} className="hover:bg-brand-navy/30 transition-colors">
              <td className="px-3 py-2.5 text-brand-cream font-medium">{e.name}</td>
              {showClient && (
                <td className="px-3 py-2.5 font-mono text-brand-slate text-[10px] truncate max-w-[130px]">
                  {clientLabel(e.userId)}
                </td>
              )}
              <td className="px-3 py-2.5 text-brand-slate truncate max-w-[160px]">{e.notes || '—'}</td>
              <td className="px-3 py-2.5 text-right font-mono text-red-400 font-semibold">{brl(e.amount)}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(e)} className="btn-ghost p-1.5 rounded-md" title="Editar">
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => onDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="btn-ghost p-1.5 rounded-md text-red-400/70 hover:text-red-400"
                    title="Remover"
                  >
                    {deletingId === e.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t border-brand-border bg-brand-navylt/20">
            <td colSpan={showClient ? 3 : 2} className="px-3 py-2 text-[10px] text-brand-slate/60 uppercase tracking-wider font-semibold">
              Subtotal
            </td>
            <td className="px-3 py-2 text-right font-mono font-bold text-red-400">
              {brl(expenses.reduce((s, e) => s + e.amount, 0))}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
