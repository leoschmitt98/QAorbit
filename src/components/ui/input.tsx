import type { InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40',
        className,
      )}
      {...props}
    />
  )
}
