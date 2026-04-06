import { useMemo } from 'react'
import { Activity, AlertTriangle, ClipboardCheck, FileClock, FolderKanban, Sparkles, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { LoadingState } from '@/components/shared/loading-state'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { StatCard } from '@/components/ui/stat-card'
import { listCatalogModules, useCatalogProjectsQuery } from '@/services/catalog-api'
import { useBugsQuery } from '@/services/bug-api'
import { listSavedFlows } from '@/services/flow-progress-api'
import { useFunctionalDocumentsQuery } from '@/services/functional-docs-api'
import { listHistoricalTests } from '@/services/historical-tests-api'
import type { ActivityItem, SavedFlowSummary } from '@/types/domain'
import { formatCompactNumber, formatDate } from '@/utils/format'

export function DashboardPage() {
  const { selectedProjectId } = useProjectScope()
  const { visibility } = useWorkspaceScope()
  const projectsQuery = useCatalogProjectsQuery()
  const bugsQuery = useBugsQuery(visibility)
  const documentsQuery = useFunctionalDocumentsQuery()
  const flowsQuery = useQuery({
    queryKey: ['dashboard-saved-flows', visibility],
    queryFn: () => listSavedFlows(visibility),
  })
  const historicalTestsQuery = useQuery({
    queryKey: ['dashboard-historical-tests', visibility],
    queryFn: () => listHistoricalTests(visibility),
  })
  const projectModulesQuery = useQuery({
    queryKey: ['dashboard-project-modules', projectsQuery.data?.map((project) => project.id).join('|') || ''],
    queryFn: async () => {
      const projects = projectsQuery.data ?? []
      const moduleEntries = await Promise.all(
        projects.map(async (project) => ({
          projectId: project.id,
          modules: await listCatalogModules(project.id).catch(() => []),
        })),
      )
      return Object.fromEntries(moduleEntries.map((entry) => [entry.projectId, entry.modules]))
    },
    enabled: Boolean(projectsQuery.data?.length),
  })

  const isLoading =
    projectsQuery.isLoading ||
    bugsQuery.isLoading ||
    documentsQuery.isLoading ||
    flowsQuery.isLoading ||
    historicalTestsQuery.isLoading ||
    projectModulesQuery.isLoading

  const allProjects = projectsQuery.data ?? []
  const allBugs = bugsQuery.data ?? []
  const allDocuments = documentsQuery.data ?? []
  const allFlows = flowsQuery.data ?? []
  const allHistoricalTests = historicalTestsQuery.data ?? []
  const modulesByProject = projectModulesQuery.data ?? {}

  const projects = selectedProjectId
    ? allProjects.filter((project) => project.id === selectedProjectId)
    : allProjects
  const bugs = selectedProjectId ? allBugs.filter((bug) => bug.projectId === selectedProjectId) : allBugs
  const documents = selectedProjectId
    ? allDocuments.filter((document) => document.projectId === selectedProjectId)
    : allDocuments
  const flows = selectedProjectId ? allFlows.filter((flow) => flow.projectId === selectedProjectId) : allFlows
  const historicalTests = selectedProjectId
    ? allHistoricalTests.filter((record) => record.projectId === selectedProjectId)
    : allHistoricalTests

  const testsInProgress = flows.filter((flow) => flow.lifecycleStatus !== 'Finalizado').length
  const testsCompleted = flows.filter((flow) => flow.lifecycleStatus === 'Finalizado').length
  const recentEvidence = flows.reduce((total, flow) => total + flow.framesCount, 0)
  const bugsByStatus = Object.entries(
    bugs.reduce<Record<string, number>>((acc, bug) => {
      acc[bug.status] = (acc[bug.status] ?? 0) + 1
      return acc
    }, {}),
  )
  const recentDocuments = [...documents]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 4)
  const recentFlows = [...flows]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 4)

  const activeProjects = useMemo(
    () =>
      projects
        .map((project) => {
          const projectModules = modulesByProject[project.id] ?? []
          const projectDocuments = documents.filter((document) => document.projectId === project.id)
          const projectBugs = bugs.filter((bug) => bug.projectId === project.id)
          const projectFlows = flows.filter((flow) => flow.projectId === project.id)
          const projectHistoricalTests = historicalTests.filter((record) => record.projectId === project.id)
          const coverageBase = Math.max(projectModules.length + projectDocuments.length + projectHistoricalTests.length, 1)
          const coverage = Math.min(
            100,
            Math.round(((projectDocuments.length + projectHistoricalTests.length) / coverageBase) * 100),
          )

          return {
            id: project.id,
            name: project.nome,
            description:
              projectFlows[0]?.title ||
              `Base operacional com ${projectModules.length} modulo(s), ${projectDocuments.length} documento(s) e ${projectBugs.length} bug(s).`,
            modulesCount: projectModules.length,
            documentsCount: projectDocuments.length,
            bugsCount: projectBugs.length,
            coverage,
          }
        })
        .sort((left, right) => {
          const leftScore = left.modulesCount + left.documentsCount + left.bugsCount
          const rightScore = right.modulesCount + right.documentsCount + right.bugsCount
          return rightScore - leftScore
        })
        .slice(0, 4),
    [projects, modulesByProject, documents, bugs, flows, historicalTests],
  )

  const activities = useMemo<ActivityItem[]>(() => {
    const flowActivities: ActivityItem[] = flows.map((flow) => ({
      id: `flow-${flow.ticketId}`,
      title: `${flow.ticketId} · ${flow.title || 'Chamado salvo'}`,
      description:
        flow.lifecycleStatus === 'Finalizado'
          ? `Chamado finalizado com reteste em ${flow.status.toLowerCase()}.`
          : `Fluxo em andamento na etapa ${flow.currentStep + 1}, com ${flow.framesCount} quadro(s) salvo(s).`,
      date: flow.updatedAt,
      type: 'execution',
    }))

    const bugActivities: ActivityItem[] = bugs.map((bug) => ({
      id: `bug-${bug.id}`,
      title: `${bug.id} · ${bug.title}`,
      description: `Bug ${bug.status.toLowerCase()} com severidade ${bug.severity.toLowerCase()} e prioridade ${bug.priority.toLowerCase()}.`,
      date: bug.updatedAt,
      type: 'bug',
    }))

    const documentActivities: ActivityItem[] = documents.map((document) => ({
      id: `document-${document.id}`,
      title: `${document.title}`,
      description: `${document.type} vinculado ao módulo ${document.moduleName || document.moduleId}.`,
      date: document.updatedAt,
      type: 'document',
    }))

    return [...flowActivities, ...bugActivities, ...documentActivities]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 6)
  }, [flows, bugs, documents])

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Central operacional"
        title="Workspace operacional de QA"
        description="Gerencie contexto funcional, analises guiadas, rastreabilidade e memoria operacional em um unico fluxo de trabalho."
        action={
          <Link to="/analysis/new">
            <GlowButton>
              <WandSparkles className="mr-2 h-4 w-4" />
              Nova analise
            </GlowButton>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/projects">
          <StatCard
            icon={FolderKanban}
            label="Projetos monitorados"
            value={String(projects.length)}
            helper="Projetos filtrados pelo escopo ativo"
          />
        </Link>
        <Link to="/bugs">
          <StatCard
            icon={AlertTriangle}
            label="Bugs e chamados"
            value={String(bugs.length)}
            helper="Registros reais vinculados ao workspace"
          />
        </Link>
        <Link to="/flows/history">
          <StatCard
            icon={Activity}
            label="Testes em andamento"
            value={String(testsInProgress)}
            helper="Chamados que ainda seguem em validacao"
          />
        </Link>
        <Link to="/historical-tests">
          <StatCard
            icon={ClipboardCheck}
            label="Analises e testes concluidos"
            value={formatCompactNumber(testsCompleted || historicalTests.length)}
            helper="Historicos e fluxos finalizados do projeto ativo"
          />
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Radar de atividade</p>
              <h2 className="font-display text-xl font-bold text-foreground">Projetos mais ativos</h2>
            </div>
            <Badge tone="info">Base viva</Badge>
          </div>
          <div className="space-y-4">
            {activeProjects.length > 0 ? (
              activeProjects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{project.name}</p>
                      <p className="text-sm text-muted">{project.description}</p>
                    </div>
                    <Link className="text-sm font-semibold text-accent" to={`/projects/${project.id}`}>
                      Ver detalhes
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-4">
                    <span>{project.modulesCount} modulos</span>
                    <span>{project.documentsCount} docs</span>
                    <span>{project.bugsCount} bugs</span>
                    <span>{project.coverage}% cobertura</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span>Base funcional e historico</span>
                      <span>{project.coverage}%</span>
                    </div>
                    <ProgressBar value={project.coverage} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 text-sm text-muted">
                Nenhum projeto foi cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Distribuicao</p>
            <h2 className="font-display text-xl font-bold text-foreground">Bugs por status</h2>
          </div>
          <div className="space-y-3">
            {bugsByStatus.length > 0 ? (
              bugsByStatus.map(([status, total]) => (
                <div key={status} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-foreground">{status}</span>
                    <span className="font-semibold text-foreground">{total}</span>
                  </div>
                  <ProgressBar value={(total / Math.max(bugs.length, 1)) * 100} />
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 text-sm text-muted">
                Nenhum bug ou chamado registrado ainda.
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm text-muted">Evidencias recentes</p>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">{recentEvidence}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm text-muted">Documentos recentes</p>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">{documents.length}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Base funcional viva</p>
              <h2 className="font-display text-xl font-bold text-foreground">Documentos recentes</h2>
            </div>
            <Link className="text-sm font-semibold text-accent" to="/functional-base">
              Abrir biblioteca
            </Link>
          </div>
          <div className="space-y-3">
            {recentDocuments.length > 0 ? (
              recentDocuments.map((document) => (
                <Link
                  key={document.id}
                  to={`/functional-base/${document.id}`}
                  className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-accent/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground">{document.title}</p>
                      <p className="mt-1 text-sm text-muted">{document.summary || 'Sem resumo informado.'}</p>
                    </div>
                    <Badge tone="neutral">{document.version}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {document.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 text-sm text-muted">
                Nenhum documento funcional foi adicionado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted">Atividade recente de QA</p>
              <h2 className="font-display text-xl font-bold text-foreground">Movimentacoes do workspace</h2>
            </div>
          </div>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((activity, index) => (
                <div key={activity.id} className="relative pl-6">
                  <span className="absolute left-0 top-1 h-3 w-3 rounded-full bg-accent" />
                  {index < activities.length - 1 ? (
                    <span className="absolute left-[5px] top-5 h-[calc(100%-8px)] w-px bg-white/10" />
                  ) : null}
                  <p className="font-medium text-foreground">{activity.title}</p>
                  <p className="mt-1 text-sm text-muted">{activity.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted/70">{formatDate(activity.date)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 text-sm text-muted">
                A atividade recente aparecera aqui conforme voce usar o workspace.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-accent/15 bg-accent/8 p-4">
            <div className="flex items-center gap-2 text-accent">
              <FileClock className="h-4 w-4" />
              <span className="text-sm font-semibold">Workspace lendo dados reais</span>
            </div>
            <p className="mt-2 text-sm text-foreground/80">
              Este painel agora usa projetos, bugs, documentos e fluxos salvos do proprio workspace.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Fluxos recentes de validacao</p>
              <h2 className="font-display text-xl font-bold text-foreground">Historico operacional mais recente</h2>
            </div>
            <Link className="text-sm font-semibold text-accent" to="/flows/history">
              Abrir historico
            </Link>
          </div>
          <div className="grid gap-3">
            {recentFlows.length > 0 ? (
              recentFlows.map((flow: SavedFlowSummary) => (
                <Link
                  key={flow.ticketId}
                  to={`/analysis/new?ticketId=${encodeURIComponent(flow.ticketId)}`}
                  className="rounded-2xl border border-border bg-white/[0.02] p-4 transition hover:border-accent/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{flow.title || 'Chamado salvo'}</p>
                      <p className="mt-1 text-sm text-muted">
                        {flow.ticketId} · Etapa {flow.currentStep + 1}
                      </p>
                    </div>
                    <div className="space-y-2 text-right">
                      <StatusBadge value={flow.lifecycleStatus} />
                      <StatusBadge value={flow.status} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted/70">{formatDate(flow.updatedAt)}</p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 text-sm text-muted">
                Nenhum fluxo historico salvo ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Base de regressao</p>
              <h2 className="font-display text-xl font-bold text-foreground">Historicos de teste mais recentes</h2>
            </div>
            <Badge tone="warning">Consulta viva</Badge>
          </div>
          <div className="grid gap-3">
            {historicalTests.length > 0 ? (
              [...historicalTests]
                .sort((left, right) => new Date(right.dataCriacao).getTime() - new Date(left.dataCriacao).getTime())
                .slice(0, 4)
                .map((record) => (
                  <Link
                    key={record.id}
                    to={`/historical-tests/${record.id}`}
                    className="rounded-2xl border border-border bg-white/[0.02] p-4 transition hover:border-accent/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{record.ticketId}</p>
                        <p className="mt-1 text-sm text-muted">{record.fluxoCenario}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge value={record.resultadoFinal} />
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted">{record.resumoProblema || 'Sem resumo detalhado.'}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted/70">
                      {record.temAutomacao
                        ? `Automacao ${record.frameworkAutomacao || 'mapeada'}`
                        : 'Sem automacao vinculada'}
                    </p>
                  </Link>
                ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 text-sm text-muted">
                Os historicos de teste aparecerao aqui quando voce salvar registros reutilizaveis.
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}
