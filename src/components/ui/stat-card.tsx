import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  helper: string
}

export function StatCard({ icon: Icon, label, value, helper }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm text-muted">{label}</p>
          <div>
            <p className="font-display text-3xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted/80">{helper}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.03] p-3">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </div>
    </Card>
  )
}
