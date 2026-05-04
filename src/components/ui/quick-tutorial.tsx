import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'

interface QuickTutorialStep {
  title: string
  description: string
}

interface QuickTutorialProps {
  eyebrow?: string
  title: string
  description: string
  steps: QuickTutorialStep[]
  currentStep?: number
  totalStepsLabel?: string
}

export function QuickTutorial({
  eyebrow = 'Uso rapido',
  title,
  description,
  steps,
  currentStep = 0,
  totalStepsLabel,
}: QuickTutorialProps) {
  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted">{eyebrow}</p>
          <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <Badge tone={currentStep > 0 ? 'success' : 'neutral'}>
          {totalStepsLabel || `Passo ${Math.max(currentStep, 1)} de ${steps.length}`}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const normalizedCurrent = Math.max(currentStep, 0)
          const isDone = index < normalizedCurrent
          const isActive = index === normalizedCurrent

          return (
            <div
              key={step.title}
              className={cn(
                'rounded-2xl border p-4',
                isActive
                  ? 'border-accent/40 bg-accent/10 shadow-glow'
                  : isDone
                    ? 'border-accent-soft/25 bg-accent-soft/10'
                    : 'border-border bg-white/[0.02]',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                    isDone
                      ? 'border-accent-soft/30 bg-accent-soft/20 text-accent-soft'
                      : isActive
                        ? 'border-accent/40 bg-accent/20 text-accent'
                        : 'border-border bg-black/20 text-muted',
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{step.description}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
