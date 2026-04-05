import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useProjectScope } from '@/hooks/use-project-scope'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useCatalogAreasQuery, useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import { listHistoricalTests } from '@/services/historical-tests-api'

export function HistoricalTestsPage() {
  const { selectedProjectId } = useProjectScope()
  const [projectIdOverride, setProjectIdOverride] = useState<string | null>(null)
  const [moduleId, setModuleId] = useState('')
  const [portalArea, setPortalArea] = useState('')
  const [search, setSearch] = useState('')
  const projectId = projectIdOverride === null ? selectedProjectId : projectIdOverride

  useEffect(() => {
    setModuleId('')
  }, [projectId])

  const historyQuery = useQuery({
    queryKey: ['historical-tests'],
    queryFn: listHistoricalTests,
  })
  const projectsQuery = useCatalogProjectsQuery()
  const modulesQuery = useCatalogModulesQuery(projectId)
  const areasQuery = useCatalogAreasQuery()

  const records = historyQuery.data ?? []
  const projectOptions = projectsQuery.data ?? []
  const moduleOptions = modulesQuery.data ?? []
  const areaOptions = areasQuery.data ?? []

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase()
    return records.filter((record) => {
      if (projectId && record.projectId !== projectId) return false
      if (moduleId && record.modulePrincipalId !== moduleId) return false
      if (portalArea && record.portalArea !== portalArea) return false

      if (!term) return true

      return [
        record.ticketId,
        record.bugId,
        record.fluxoCenario,
        record.resumoProblema,
        record.comportamentoObtido,
        record.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [records, projectId, moduleId, portalArea, search])

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Memoria operacional"
        title="Historico de Testes"
        description="Consulte cenarios antigos por modulo, area e automacao para avaliar impacto, regressao e reuso antes de liberar ajustes."
      />

      <Card className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Projeto</span>
            <select
              value={projectId}
              onChange={(event) => {
                setProjectIdOverride(event.target.value)
                setModuleId('')
              }}
              className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
            >
              <option value="">Todos</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Modulo</span>
            <select
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
            >
              <option value="">Todos</option>
              {moduleOptions.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Portal / Area</span>
            <select
              value={portalArea}
              onChange={(event) => setPortalArea(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
            >
              <option value="">Todos</option>
              {areaOptions.map((area) => (
                <option key={area.id} value={area.nome}>
                  {area.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Busca por texto</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Chamado, cenario, tag, problema..."
            />
          </label>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Registros" value={String(records.length)} />
        <MetricCard label="Filtrados" value={String(filteredRecords.length)} />
        <MetricCard label="Com automacao" value={String(records.filter((item) => item.temAutomacao).length)} />
        <MetricCard label="Com bug vinculado" value={String(records.filter((item) => item.bugId).length)} />
      </section>

      <div className="grid gap-4">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const projectName = projectOptions.find((item) => item.id === record.projectId)?.nome ?? record.projectId
            const moduleName = moduleOptions.find((item) => item.id === record.modulePrincipalId)?.nome ?? record.modulePrincipalId
            return (
              <Card key={record.id} className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-display text-xl font-bold text-foreground">{record.fluxoCenario}</p>
                    <p className="mt-2 text-sm text-muted">
                      {record.ticketId} · {projectName || '-'} · {moduleName || '-'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={record.resultadoFinal} />
                    {record.temAutomacao ? <StatusBadge value={record.frameworkAutomacao || 'Automatizado'} /> : null}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-5">
                  <InfoBlock label="Portal / Area" value={record.portalArea || '-'} />
                  <InfoBlock label="Criticidade" value={record.criticidade} />
                  <InfoBlock label="Automacao" value={record.temAutomacao ? record.frameworkAutomacao || 'Sim' : 'Nao'} />
                  <InfoBlock label="Modulos impactados" value={String(record.modulosImpactados.length)} />
                  <InfoBlock label="Tags" value={record.tags.join(', ') || '-'} />
                </div>

                <p className="text-sm text-muted">{record.resumoProblema || 'Sem resumo informado.'}</p>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={`/historical-tests/${encodeURIComponent(record.id)}`}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow"
                  >
                    Ver detalhes
                  </Link>
                  <span className="text-sm text-muted">
                    Pronto para futura acao de <span className="font-semibold text-foreground">Analisar impacto historico</span>.
                  </span>
                </div>
              </Card>
            )
          })
        ) : (
          <Card className="space-y-2">
            <p className="font-semibold text-foreground">Nenhum registro encontrado</p>
            <p className="text-sm text-muted">
              Assim que voce salvar um teste no historico, ele aparecera aqui para consulta por modulo e cenario.
            </p>
          </Card>
        )}
      </div>
    </div>
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
