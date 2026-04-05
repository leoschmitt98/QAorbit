import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border bg-panel/88 p-5 shadow-soft backdrop-blur-xl transition duration-200 hover:border-accent/25 hover:shadow-glow',
        className,
      )}
      {...props}
    />
  )
}
