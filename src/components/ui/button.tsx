import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition duration-200',
        variant === 'primary' &&
          'border border-accent/40 bg-accent text-background shadow-glow hover:bg-[#b6ff3f]',
        variant === 'secondary' &&
          'border border-border bg-white/[0.03] text-foreground hover:border-accent/35 hover:bg-accent/8',
        variant === 'ghost' && 'text-muted hover:bg-white/[0.04] hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
