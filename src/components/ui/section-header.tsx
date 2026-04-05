import type { ReactNode } from 'react'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p> : null}
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
          <p className="max-w-3xl text-sm text-muted">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
