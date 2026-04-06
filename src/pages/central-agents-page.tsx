import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { AgentCard } from '@/components/shared/agent-card'
import { LoadingState } from '@/components/shared/loading-state'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { agents } from '@/data/mock-data'
import { listSavedFlows } from '@/services/flow-progress-api'

export function CentralAgentsPage() {
  const navigate = useNavigate()
  const { selectedProjectId } = useProjectScope()
  const { visibility } = useWorkspaceScope()
  const [selectedTicketId, setSelectedTicketId] = useState('')

  const savedFlowsQuery = useQuery({
    queryKey: ['saved-flows-agents', visibility],
    queryFn: () => listSavedFlows(visibility),
  })

  const savedFlows = useMemo(
    () =>
      (savedFlowsQuery.data ?? []).filter((flow) =>
        selectedProjectId ? flow.projectId === selectedProjectId : true,
      ),
    [savedFlowsQuery.data, selectedProjectId],
  )
  const selectedFlow = useMemo(
    () => savedFlows.find((flow) => flow.ticketId === selectedTicketId) ?? savedFlows[0] ?? null,
    [savedFlows, selectedTicketId],
  )

  function handleStart(agentId: string, promptMode: string, suggestedStep: number) {
    const searchParams = new URLSearchParams()
    searchParams.set('agent', agentId)
    searchParams.set('promptMode', promptMode)
    searchParams.set('step', String(suggestedStep))
    if (selectedFlow?.ticketId) {
      searchParams.set('ticketId', selectedFlow.ticketId)
    }

    navigate(`/analysis/new?${searchParams.toString()}`)
  }

  if (savedFlowsQuery.isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Central de agentes"
        title="Agentes operacionais orientados por chamado"
        description="Use esta central para decidir como atacar o caso atual: diagnostico de fluxo no repositorio, teste plan em Gherkin ou avaliacao de automacao Cypress."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Contexto ativo</p>
            <h3 className="font-display text-xl font-bold text-foreground">Vincule um chamado antes de iniciar</h3>
            <p className="mt-2 text-sm text-muted">
              A central faz mais sentido quando trabalha em cima de um chamado salvo. Assim os agentes reaproveitam regra, evidencias, changelog do dev e historico relacionado.
            </p>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Chamado em atendimento</span>
            <select
              value={selectedFlow?.ticketId || ''}
              onChange={(event) => setSelectedTicketId(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
            >
              <option value="">Selecione um chamado salvo</option>
              {savedFlows.map((flow) => (
                <option key={flow.ticketId} value={flow.ticketId}>
                  {flow.ticketId} · {flow.title}
                </option>
              ))}
            </select>
          </label>

          {selectedFlow ? (
            <div className="grid gap-3 md:grid-cols-2">
              <ContextStat label="Chamado" value={selectedFlow.ticketId} />
              <ContextStat label="Status do reteste" value={selectedFlow.status} />
              <ContextStat label="Etapa atual" value={`Etapa ${selectedFlow.currentStep + 1}`} />
              <ContextStat label="Historicos salvos" value={String(selectedFlow.historyRecordsCount ?? 0)} />
              <ContextStat label="Quadros capturados" value={String(selectedFlow.framesCount)} />
              <ContextStat label="Cenarios extras" value={String(selectedFlow.scenariosCount)} />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
              Nenhum chamado foi vinculado ainda. Selecione um rascunho salvo para iniciar um agente com contexto real.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {selectedFlow ? (
              <>
                <GlowButton onClick={() => navigate(`/analysis/new?ticketId=${encodeURIComponent(selectedFlow.ticketId)}`)}>
                  Abrir chamada na Nova Analise
                </GlowButton>
                <StatusBadge value={selectedFlow.lifecycleStatus} />
              </>
            ) : (
              <GlowButton onClick={() => navigate('/analysis/new')}>Abrir Nova Analise sem contexto</GlowButton>
            )}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Como esta tela opera agora</p>
            <h3 className="font-display text-xl font-bold text-foreground">Trilha recomendada</h3>
          </div>

          <div className="space-y-3">
            <GuidanceItem
              title="1. Analise de Fluxo"
              description="Use quando houver changelog do dev, hotfix, artefatos suspeitos ou duvida sobre aderencia da regra no repositorio."
            />
            <GuidanceItem
              title="2. Teste Plan Gherkin"
              description="Use quando o chamado precisa virar um cenario claro, reutilizavel e rastreavel para QA manual e regressao."
            />
            <GuidanceItem
              title="3. Automacao Cypress"
              description="Use quando o fluxo estiver maduro o suficiente para decidir escopo, viabilidade e estrutura inicial do spec."
            />
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/8 p-4">
            <p className="text-sm font-semibold text-foreground">Regra de uso</p>
            <p className="mt-2 text-sm text-muted">
              Os agentes nao sao bots soltos. Eles representam estrategias de analise, sempre puxando o contexto do chamado para gerar um prompt ou fluxo mais assertivo.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selectedFlow={selectedFlow}
            onStart={(selectedAgent) =>
              handleStart(selectedAgent.id, selectedAgent.promptMode, selectedAgent.suggestedStep)
            }
          />
        ))}
      </section>
    </div>
  )
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function GuidanceItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  )
}
