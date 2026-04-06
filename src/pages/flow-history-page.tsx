import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import { deleteFlowProgress, listSavedFlows } from '@/services/flow-progress-api'
import type { SavedFlowSummary } from '@/types/domain'
import { formatDate } from '@/utils/format'

export function FlowHistoryPage() {
  const { selectedProjectId } = useProjectScope()
  const { visibility } = useWorkspaceScope()
  const queryClient = useQueryClient()
  const flowsQuery = useQuery({
    queryKey: ['saved-flow-history', visibility],
    queryFn: () => listSavedFlows(visibility),
  })
  const projectsQuery = useCatalogProjectsQuery()

  const flows = (flowsQuery.data ?? []).filter((flow) =>
    selectedProjectId ? flow.projectId === selectedProjectId : true,
  )
  const projectOptions = projectsQuery.data ?? []
  const grouped = {
    andamento: flows.filter((flow) => flow.lifecycleStatus !== 'Finalizado'),
    finalizados: flows.filter((flow) => flow.lifecycleStatus === 'Finalizado'),
  }

  if (flowsQuery.isLoading || projectsQuery.isLoading) return <LoadingState />

  async function handleDelete(ticketId: string) {
    if (!window.confirm(`Deseja excluir o chamado ${ticketId} do workspace? Esta acao remove progresso, bug vinculado e historico associado.`)) {
      return
    }

    await deleteFlowProgress(ticketId)
    await queryClient.invalidateQueries({ queryKey: ['saved-flow-history'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-saved-flows'] })
    await queryClient.invalidateQueries({ queryKey: ['saved-flows-agents'] })
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Historico de fluxos"
        title="Chamados salvos e memoria operacional"
        description="Acompanhe os chamados em andamento, localize validacoes finalizadas e retome o trabalho sem perder contexto."
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Chamados salvos" value={String(flows.length)} />
        <MetricCard label="Em andamento" value={String(grouped.andamento.length)} />
        <MetricCard label="Finalizados" value={String(grouped.finalizados.length)} />
        <MetricCard
          label="Ultima atividade"
          value={flows[0]?.updatedAt ? formatDate(flows[0].updatedAt) : 'Sem registros'}
        />
      </section>

      <FlowSection
        title="Em andamento"
        description="Chamados que ainda estao em validacao e podem ser retomados a qualquer momento."
        flows={grouped.andamento}
        projectOptions={projectOptions}
        onDelete={handleDelete}
      />

      <FlowSection
        title="Finalizados"
        description="Chamados concluidos que permanecem disponiveis para consulta, reabertura ou reaproveitamento."
        flows={grouped.finalizados}
        projectOptions={projectOptions}
        onDelete={handleDelete}
      />
    </div>
  )
}

function FlowSection({
  title,
  description,
  flows,
  projectOptions,
  onDelete,
}: {
  title: string
  description: string
  flows: SavedFlowSummary[]
  projectOptions: Array<{ id: string; nome: string }>
  onDelete: (ticketId: string) => Promise<void>
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>

      {flows.length > 0 ? (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <FlowCard key={flow.ticketId} flow={flow} projectOptions={projectOptions} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <Card className="space-y-2">
          <p className="font-semibold text-foreground">Nenhum chamado nesta categoria</p>
          <p className="text-sm text-muted">Assim que voce salvar ou finalizar um chamado, ele aparecera aqui.</p>
        </Card>
      )}
    </section>
  )
}

function FlowCard({
  flow,
  projectOptions,
  onDelete,
}: {
  flow: SavedFlowSummary
  projectOptions: Array<{ id: string; nome: string }>
  onDelete: (ticketId: string) => Promise<void>
}) {
  const projectName = projectOptions.find((item) => item.id === flow.projectId)?.nome ?? (flow.projectId || '-')
  const moduleQuery = useCatalogModulesQuery(flow.projectId)
  const moduleName =
    moduleQuery.data?.find((item) => item.id === flow.moduleId)?.nome ?? (flow.moduleId || '-')

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-display text-2xl font-bold text-foreground">{flow.title || 'Chamado salvo'}</p>
          <p className="mt-2 text-sm text-muted">
            {flow.ticketId} · {projectName} · {moduleName}
          </p>
          {flow.ownerName ? (
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">QA responsavel: {flow.ownerName}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-2 rounded-2xl border border-border bg-white/[0.02] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Status do chamado</p>
            <StatusBadge value={flow.lifecycleStatus} />
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-white/[0.02] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Resultado do reteste</p>
            <StatusBadge value={flow.status} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <InfoBlock label="Ambiente" value={flow.environment || '-'} />
        <InfoBlock label="Versao" value={flow.version || '-'} />
        <InfoBlock label="Etapa atual" value={`Etapa ${flow.currentStep + 1}`} />
        <InfoBlock label="Quadros salvos" value={String(flow.framesCount)} />
        <InfoBlock label="Cenarios extras" value={String(flow.scenariosCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,auto]">
        <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
          <p>Ultima atualizacao: {formatDate(flow.updatedAt)}</p>
          <p className="mt-2">
            {flow.lifecycleStatus === 'Finalizado'
              ? `Finalizado em ${flow.finalizedAt ? formatDate(flow.finalizedAt) : 'data nao registrada'}.`
              : 'Chamado em andamento, pronto para continuar da etapa salva.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/analysis/new?ticketId=${encodeURIComponent(flow.ticketId)}`}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow"
          >
            {flow.lifecycleStatus === 'Finalizado' ? 'Abrir chamado' : 'Continuar chamado'}
          </Link>
          <Link
            to={`/bugs/new?ticketId=${encodeURIComponent(flow.ticketId)}`}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.02] px-4 text-sm font-semibold text-foreground transition hover:border-accent/20"
          >
            Abrir bug vinculado
          </Link>
          <button
            type="button"
            onClick={() => void onDelete(flow.ticketId)}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.02] px-4 text-sm font-semibold text-foreground transition hover:border-red-400/40 hover:text-red-200"
          >
            Excluir chamado
          </button>
        </div>
      </div>
    </Card>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="space-y-2">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl font-bold text-foreground">{value}</p>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  )
}
