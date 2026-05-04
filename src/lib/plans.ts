export type PlanId = 'free' | 'plano1' | 'plano2' | 'escritorio' | 'start'

export type PlanPolicy = {
  id: PlanId
  name: string
  priceLabel: string
  trialDays?: number
  limits: {
    docsPerDay: number
    maxUsers: number
    maxProcesses: number
    allowExpandTribunais: boolean
    allowPriorityQueue: boolean
    allowAdvancedRerank: boolean
    allowExport: boolean
    allowBatchAnalysis: boolean
    allowCustomTemplates: boolean
    allowAuditLog: boolean
    allowWhiteLabel: boolean
    allowApiAccess: boolean
    versionHistoryDays: number   // 0 = sem histórico, -1 = ilimitado
    batchSize: number            // máximo de processos em lote (0 = desabilitado)
  }
  perks: string[]
}

export const PLAN_POLICIES: Record<PlanId, PlanPolicy> = {
  free: {
    id: 'free',
    name: 'Trial',
    priceLabel: 'R$ 0,00',
    trialDays: 7,
    limits: {
      docsPerDay: 2,
      maxUsers: 1,
      maxProcesses: 14,
      allowExpandTribunais: false,
      allowPriorityQueue: false,
      allowAdvancedRerank: false,
      allowExport: false,
      allowBatchAnalysis: false,
      allowCustomTemplates: false,
      allowAuditLog: false,
      allowWhiteLabel: false,
      allowApiAccess: false,
      versionHistoryDays: 7,
      batchSize: 0,
    },
    perks: [
      'Teste por 7 dias',
      'Até 2 documentos por dia',
    ],
  },
  plano1: {
    id: 'plano1',
    name: 'Starter',
    priceLabel: 'R$ 89,90',
    limits: {
      docsPerDay: 10,
      maxUsers: 1,
      maxProcesses: 120,
      allowExpandTribunais: true,
      allowPriorityQueue: true,
      allowAdvancedRerank: true,
      allowExport: true,
      allowBatchAnalysis: false,
      allowCustomTemplates: false,
      allowAuditLog: false,
      allowWhiteLabel: false,
      allowApiAccess: false,
      versionHistoryDays: 30,
      batchSize: 0,
    },
    perks: [
      'Expandir tribunais',
      'Rerank avançado',
      'Fila prioritária',
      'Export PDF e Word',
      'Histórico 30 dias',
    ],
  },
  plano2: {
    id: 'plano2',
    name: 'Pro',
    priceLabel: 'R$ 179,90',
    limits: {
      docsPerDay: 30,
      maxUsers: 1,
      maxProcesses: 420,
      allowExpandTribunais: true,
      allowPriorityQueue: true,
      allowAdvancedRerank: true,
      allowExport: true,
      allowBatchAnalysis: true,
      allowCustomTemplates: true,
      allowAuditLog: false,
      allowWhiteLabel: false,
      allowApiAccess: true,
      versionHistoryDays: 365,
      batchSize: 5,
    },
    perks: [
      'Maior volume diário',
      'Expandir tribunais',
      'Rerank avançado',
      'Análise em lote (5 processos)',
      'Templates personalizados',
      'Histórico 12 meses',
      'Acesso à API',
    ],
  },
  escritorio: {
    id: 'escritorio',
    name: 'Escritório',
    priceLabel: 'R$ 459,90',
    limits: {
      docsPerDay: 120,
      maxUsers: 6,
      maxProcesses: 2100,
      allowExpandTribunais: true,
      allowPriorityQueue: true,
      allowAdvancedRerank: true,
      allowExport: true,
      allowBatchAnalysis: true,
      allowCustomTemplates: true,
      allowAuditLog: true,
      allowWhiteLabel: true,
      allowApiAccess: true,
      versionHistoryDays: -1,
      batchSize: 20,
    },
    perks: [
      'Até 6 usuários',
      'Base compartilhada',
      'Suporte prioritário',
      'Análise em lote (20 processos)',
      'Log de auditoria',
      'White-label (logo do escritório)',
      'Histórico ilimitado',
      'Acesso à API',
    ],
  },
  start: {
    id: 'start',
    name: 'Enterprise',
    priceLabel: 'Sob consulta',
    limits: {
      docsPerDay: 300,
      maxUsers: 20,
      maxProcesses: 10000,
      allowExpandTribunais: true,
      allowPriorityQueue: true,
      allowAdvancedRerank: true,
      allowExport: true,
      allowBatchAnalysis: true,
      allowCustomTemplates: true,
      allowAuditLog: true,
      allowWhiteLabel: true,
      allowApiAccess: true,
      versionHistoryDays: -1,
      batchSize: 0,
    },
    perks: [
      'Plano customizado',
      'Onboarding dedicado',
      'SLA comercial',
      'Integrações (e-proc, SAJ, PJe)',
      'Análise em lote ilimitada',
      'Success manager dedicado',
      'Histórico ilimitado',
      'API ilimitada',
    ],
  },
}

export function normalizePlan(input: string | undefined | null): PlanId {
  const raw = String(input || '').toLowerCase().replace(/\s+/g, '')
  if (raw === 'trial' || raw === 'free') return 'free'
  if (raw === 'plano1' || raw === 'starter') return 'plano1'
  if (raw === 'plano2' || raw === 'pro') return 'plano2'
  if (raw === 'escritorio') return 'escritorio'
  if (raw === 'start' || raw === 'enterprise') return 'start'
  return 'free'
}

export function planForUserPlan(input: string | undefined | null): PlanPolicy {
  const id = normalizePlan(input)
  return PLAN_POLICIES[id]
}

export function todayDateKey(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function computeTrialEndsAt(startIso: string, trialDays: number) {
  const d = new Date(startIso)
  d.setDate(d.getDate() + trialDays)
  return d.toISOString()
}
