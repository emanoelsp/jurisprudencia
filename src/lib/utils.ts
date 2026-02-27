// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCNJ(numero: string): string {
  // Format: 1234567-89.2023.8.26.0100
  const clean = numero.replace(/\D/g, '')
  if (clean.length === 20) {
    return `${clean.slice(0,7)}-${clean.slice(7,9)}.${clean.slice(9,13)}.${clean.slice(13)}.${clean.slice(14,16)}.${clean.slice(16)}`
  }
  return numero
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:    'Pendente',
    processing: 'Processando',
    analyzed:   'Analisado',
    approved:   'Aprovado',
    error:      'Erro',
  }
  return map[status] ?? status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:    'bg-brand-slate',
    processing: 'bg-brand-indigo animate-pulse',
    analyzed:   'bg-amber-400',
    approved:   'bg-emerald-400',
    error:      'bg-red-400',
  }
  return map[status] ?? 'bg-brand-slate'
}

export function scoreToColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}
