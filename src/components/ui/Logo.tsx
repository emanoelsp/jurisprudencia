// src/components/ui/Logo.tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}

const sizes = {
  sm: { text: 'text-lg tracking-[0.08em]',   ia: 'text-lg tracking-[0.08em]'  },
  md: { text: 'text-2xl tracking-[0.09em]',  ia: 'text-2xl tracking-[0.09em]' },
  lg: { text: 'text-4xl tracking-[0.1em]',   ia: 'text-4xl tracking-[0.1em]' },
}

export default function Logo({ size = 'md', href = '/dashboard', className }: LogoProps) {
  const s = sizes[size]
  const content = (
    <span className={cn('inline-flex items-baseline gap-0 select-none', className)}>
      <span className={cn('font-display font-bold tracking-tight text-brand-cream', s.text)}>
        IURIS
      </span>
      <span className={cn('font-display font-semibold tracking-tight text-brand-indigo', s.ia)}>
        PRUDENTIA
      </span>
    </span>
  )

  if (href) {
    return <Link href={href} className="hover:opacity-90 transition-opacity">{content}</Link>
  }
  return content
}
