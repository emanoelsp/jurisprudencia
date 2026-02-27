// src/components/ui/ConfidenceBadge.tsx
import type { ConfidenceBadge as TBadge } from '@/types'
import { ShieldCheck, Shield, ShieldAlert } from 'lucide-react'

export default function ConfidenceBadge({ badge, score }: { badge: TBadge; score?: number }) {
  const configs = {
    alta:  { label: 'Alta Confiança',   icon: ShieldCheck, cls: 'badge-alta' },
    media: { label: 'Média Confiança',  icon: Shield,      cls: 'badge-media' },
    baixa: { label: 'Baixa Confiança',  icon: ShieldAlert, cls: 'badge-baixa' },
  }
  const { label, icon: Icon, cls } = configs[badge]
  return (
    <span className={cls}>
      <Icon size={10} />
      {label}
      {score !== undefined && ` · ${Math.round(score * 100)}%`}
    </span>
  )
}
