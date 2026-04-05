import type { ReactNode } from 'react'
import { ArrowRight, ExternalLink, Link2 } from 'lucide-react'
import type { AgentDefinition, SavedFlowSummary } from '@/types/domain'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import { StatusBadge } from '@/components/ui/status-badge'

interface AgentCardProps {
  agent: AgentDefinition
  selectedFlow?: SavedFlowSummary | null
  onStart: (agent: AgentDefinition) => void
}

export function AgentCard({ agent, selectedFlow, onStart }: AgentCardProps) {
  const canStart = !agent.requiresLinkedTicket || Boolean(selectedFlow?.ticketId)

  return (
    <Card className="group h-full space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-accent">
          {agent.focus}
        </span>
        <StatusBadge value={agent.executor} />
        {agent.requiresLinkedTicket ? <StatusBadge value="Requer chamado vinculado" /> : null}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground">{agent.name}</h3>
          <p className="mt-2 text-sm text-muted">{agent.description}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <InfoBlock label="Melhor uso" value={agent.recommendedFor} />
        <InfoBlock label="Saida esperada" value={agent.expectedOutput} />
        <InfoBlock
          label="Chamado vinculado"
          value={
            selectedFlow?.ticketId
              ? `${selectedFlow.ticketId} · ${selectedFlow.title}`
              : 'Selecione um chamado salvo para iniciar com contexto.'
          }
          icon={<Link2 className="h-4 w-4 text-accent" />}
        />
      </div>

      <div className="flex gap-3">
        <GlowButton className="flex-1 justify-between" onClick={() => onStart(agent)} disabled={!canStart}>
          {canStart ? 'Iniciar com contexto' : 'Selecionar chamado primeiro'}
          <ArrowRight className="h-4 w-4" />
        </GlowButton>
        <GlowButton className="px-4" onClick={() => onStart(agent)}>
          <ExternalLink className="h-4 w-4" />
        </GlowButton>
      </div>
    </Card>
  )
}

function InfoBlock({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      </div>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  )
}
