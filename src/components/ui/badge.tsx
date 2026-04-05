import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide',
        tone === 'neutral' && 'border-border bg-white/[0.04] text-muted',
        tone === 'success' && 'border-accent-soft/25 bg-accent-soft/12 text-accent-soft',
        tone === 'warning' && 'border-accent/25 bg-accent/10 text-accent',
        tone === 'danger' && 'border-lime-200/20 bg-lime-200/10 text-lime-100',
        tone === 'info' && 'border-emerald-200/20 bg-emerald-200/10 text-emerald-100',
        className,
      )}
      {...props}
    />
  )
}
