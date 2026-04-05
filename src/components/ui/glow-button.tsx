import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function GlowButton({ className, active, ...props }: GlowButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition-all duration-200',
        active
          ? 'border-accent/40 bg-accent/15 text-foreground shadow-glow'
          : 'border-border bg-panel/80 text-foreground hover:border-accent/40 hover:bg-accent/10 hover:shadow-glow',
        className,
      )}
      {...props}
    />
  )
}
