'use client'

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-3 bg-brand-border/60 rounded animate-pulse ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-md bg-brand-border/60 animate-pulse" />
        <SkeletonLine className="w-20 h-4" />
        <SkeletonLine className="w-16 h-4" />
      </div>
      <SkeletonLine className="w-3/4" />
      <SkeletonLine className="w-1/2" />
      <SkeletonLine className="w-full" />
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-brand-navylt/50 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-brand-border/60" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-1/3 h-4" />
            <SkeletonLine className="w-1/2" />
          </div>
          <SkeletonLine className="w-16 h-5" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2 animate-pulse">
          <SkeletonLine className="w-16 h-3" />
          <SkeletonLine className="w-10 h-6" />
        </div>
      ))}
    </div>
  )
}
