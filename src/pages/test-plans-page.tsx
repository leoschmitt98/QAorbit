import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { useTestPlansQuery } from '@/services/test-plans-api'
import { Card } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/loading-state'
import { SectionHeader } from '@/components/ui/section-header'

export function TestPlansPage() {
  const { selectedProjectId } = useProjectScope()
  const { visibility } = useWorkspaceScope()
  const testPlansQuery = useTestPlansQuery(visibility)
  const records = testPlansQuery.data ?? []

  const grouped = useMemo(() => {
    const filtered = selectedProjectId ? records.filter((record) => record.projectId === selectedProjectId) : records
    const projectsMap = new Map<
      string,
      { id: string; nome: string; modules: Map<string, { id: string; nome: string; records: typeof filtered }> }
    >()

    filtered.forEach((record) => {
      const projectKey = record.projectId || 'sem-projeto'
      const moduleKey = record.moduleId || 'sem-modulo'
      const projectEntry =
        projectsMap.get(projectKey) ??
        { id: projectKey, nome: record.projectName || 'Projeto nao informado', modules: new Map() }
      const moduleEntry =
        projectEntry.modules.get(moduleKey) ??
        { id: moduleKey, nome: record.moduleName || 'Modulo nao informado', records: [] as typeof filtered }
      moduleEntry.records.push(record)
      projectEntry.modules.set(moduleKey, moduleEntry)
      projectsMap.set(projectKey, projectEntry)
    })

    return [...projectsMap.values()].map((project) => ({
      ...project,
      modules: [...project.modules.values()],
    }))
  }, [records, selectedProjectId])

  if (testPlansQuery.isLoading) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Test Plans"
        title="Escopos e planos de teste"
        description="Consulte os rascunhos gerados a partir dos chamados e finalize manualmente os planos de teste com steps definidos pelo QA."
      />

      {grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map((project) => (
            <Card key={project.id} className="space-y-4">
              <div>
                <p className="text-sm text-muted">Projeto</p>
                <h2 className="font-display text-xl font-bold text-foreground">{project.nome}</h2>
              </div>

              <div className="space-y-4 border-l border-accent/20 pl-4">
                {project.modules.map((module) => (
                  <div key={module.id} className="space-y-3 rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">Modulo</p>
                        <p className="font-semibold text-foreground">{module.nome}</p>
                      </div>
                      <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                        {module.records.length} test plan(s)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {module.records.map((record) => (
                        <Link
                          key={record.id}
                          to={`/test-plans/${record.id}`}
                          className="block rounded-2xl border border-border bg-black/20 px-4 py-3 transition hover:border-accent/25"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{record.titulo}</p>
                              <p className="mt-1 text-sm text-muted">{record.objetivo || 'Sem objetivo informado.'}</p>
                              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                                {record.ownerName ? `QA: ${record.ownerName}` : 'Sem QA identificado'}
                              </p>
                            </div>
                            <div className="text-right text-sm text-muted">
                              <p className="font-semibold text-foreground">{record.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}</p>
                              <p>{record.stepsCount} step(s)</p>
                              <p>{new Date(record.updatedAt).toLocaleString('pt-BR')}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="space-y-3">
          <p className="font-semibold text-foreground">Nenhum Test Plan encontrado</p>
          <p className="text-sm text-muted">
            Marque a opcao de gerar escopo de Test Plan ao finalizar um chamado para criar os primeiros rascunhos.
          </p>
        </Card>
      )}
    </div>
  )
}
