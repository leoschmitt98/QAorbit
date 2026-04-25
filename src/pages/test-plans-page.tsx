import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { useTestPlansQuery } from '@/services/test-plans-api'
import { Card } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/loading-state'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import type { TestPlanRecord } from '@/types/domain'

interface GroupedModule {
  id: string
  nome: string
  records: TestPlanRecord[]
}

interface GroupedArea {
  id: string
  nome: string
  modules: GroupedModule[]
  totalPlans: number
}

interface GroupedProject {
  id: string
  nome: string
  areas: GroupedArea[]
}

export function TestPlansPage() {
  const { selectedProjectId } = useProjectScope()
  const { visibility } = useWorkspaceScope()
  const testPlansQuery = useTestPlansQuery(visibility)
  const records = testPlansQuery.data ?? []

  const grouped = useMemo<GroupedProject[]>(() => {
    const filtered = selectedProjectId ? records.filter((record) => record.projectId === selectedProjectId) : records
    const projectsMap = new Map<
      string,
      {
        id: string
        nome: string
        areas: Map<string, { id: string; nome: string; modules: Map<string, GroupedModule> }>
      }
    >()

    filtered.forEach((record) => {
      const projectKey = record.projectId || 'sem-projeto'
      const areaKey = record.areaId || 'sem-area'
      const moduleKey = record.moduleId || 'sem-modulo'

      const projectEntry =
        projectsMap.get(projectKey) ??
        {
          id: projectKey,
          nome: record.projectName || 'Projeto nao informado',
          areas: new Map(),
        }

      const areaEntry =
        projectEntry.areas.get(areaKey) ??
        {
          id: areaKey,
          nome: record.areaName || 'Area nao informada',
          modules: new Map<string, GroupedModule>(),
        }

      const moduleEntry =
        areaEntry.modules.get(moduleKey) ??
        {
          id: moduleKey,
          nome: record.moduleName || 'Modulo nao informado',
          records: [],
        }

      moduleEntry.records.push(record)
      areaEntry.modules.set(moduleKey, moduleEntry)
      projectEntry.areas.set(areaKey, areaEntry)
      projectsMap.set(projectKey, projectEntry)
    })

    return [...projectsMap.values()].map((project) => ({
      id: project.id,
      nome: project.nome,
      areas: [...project.areas.values()].map((area) => {
        const modules = [...area.modules.values()]
          .map((module) => ({
            ...module,
            records: [...module.records].sort((left, right) => left.titulo.localeCompare(right.titulo)),
          }))
          .sort((left, right) => left.nome.localeCompare(right.nome))

        return {
          id: area.id,
          nome: area.nome,
          modules,
          totalPlans: modules.reduce((accumulator, module) => accumulator + module.records.length, 0),
        }
      }).sort((left, right) => left.nome.localeCompare(right.nome)),
    })).sort((left, right) => left.nome.localeCompare(right.nome))
  }, [records, selectedProjectId])

  if (testPlansQuery.isLoading) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Test Plans"
        title="Escopos e planos de teste"
        description="Consulte os rascunhos gerados a partir dos chamados e navegue pela estrutura Projeto > Area > Modulo > Test Plan."
      />

      {grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map((project) => (
            <Card key={project.id} className="space-y-4">
              <div>
                <p className="text-sm text-muted">Projeto</p>
                <h2 className="font-display text-xl font-bold text-foreground">{project.nome}</h2>
              </div>

              <div className="space-y-5 border-l border-accent/20 pl-4">
                {project.areas.map((area) => (
                  <div key={area.id} className="space-y-4 rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">Local de teste</p>
                        <p className="font-semibold text-foreground">{area.nome}</p>
                      </div>
                      <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                        {area.totalPlans} test plan(s)
                      </span>
                    </div>

                    <div className="space-y-4 border-l border-accent/15 pl-4">
                      {area.modules.map((module) => (
                        <div key={module.id} className="space-y-3 rounded-2xl border border-border bg-black/20 p-4">
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
                                className="block rounded-2xl border border-border bg-panel/70 px-4 py-3 transition hover:border-accent/25"
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
                                    <div className="flex justify-end">
                                      <StatusBadge value={record.status === 'finalizado' ? 'Finalizado' : 'Rascunho'} />
                                    </div>
                                    <p className="mt-2">{record.stepsCount} step(s)</p>
                                    <p>{new Date(record.updatedAt).toLocaleString('pt-BR')}</p>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
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
