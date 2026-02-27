// src/components/ui/Logo.tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}

const sizes = {
  sm: { text: 'text-xl',   ia: 'text-xl'  },
  md: { text: 'text-2xl',  ia: 'text-2xl' },
  lg: { text: 'text-4xl',  ia: 'text-4xl' },
}

export default function Logo({ size = 'md', href = '/dashboard', className }: LogoProps) {
  const s = sizes[size]
  const content = (
    <span className={cn('inline-flex items-baseline gap-0 select-none', className)}>
      <span className={cn('font-display font-bold tracking-tight text-brand-cream', s.text)}>
        Jurisprudenc
      </span>
      <span className={cn('font-display font-black tracking-tight text-brand-indigo', s.ia)}>
        IA
      </span>
    </span>
  )

  if (href) {
    return <Link href={href} className="hover:opacity-90 transition-opacity">{content}</Link>
  }
  return content
}
