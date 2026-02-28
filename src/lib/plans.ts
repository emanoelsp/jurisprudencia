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
    },
    perks: [
      'Expandir tribunais',
      'Rerank avançado',
      'Fila prioritária',
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
    },
    perks: [
      'Maior volume diário',
      'Expandir tribunais',
      'Rerank avançado',
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
    },
    perks: [
      'Até 6 usuários',
      'Base compartilhada',
      'Suporte prioritário',
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
    },
    perks: [
      'Plano customizado',
      'Onboarding dedicado',
      'SLA comercial',
    ],
  },
}

export function normalizePlan(input: string | undefined | null): PlanId {
  const raw = String(input || '').toLowerCase().replace(/\s+/g, '')
  if (raw === 'trial' || raw === 'free') return 'free'
  if (raw === 'plano1') return 'plano1'
  if (raw === 'plano2') return 'plano2'
  if (raw === 'escritorio') return 'escritorio'
  if (raw === 'start') return 'start'
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
