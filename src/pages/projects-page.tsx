import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useCatalogProjectsQuery } from '@/services/catalog-api'

export function ProjectsPage() {
  const { selectedProjectId, setSelectedProjectId } = useProjectScope()
  const [search, setSearch] = useState('')
  const projectsQuery = useCatalogProjectsQuery()

  const filteredProjects = useMemo(
    () =>
      (projectsQuery.data ?? []).filter((project) =>
        project.nome.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [projectsQuery.data, search],
  )

  if (projectsQuery.isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Gestao de projetos"
        title="Projetos e frentes monitoradas"
        description="Use esta aba para entrar no contexto de cada produto, separar o workspace por projeto e organizar modulos e documentacao funcional."
        action={<Button disabled>Novo projeto</Button>}
      />

      <Card className="grid gap-4 lg:grid-cols-[1fr,auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome do projeto..."
        />
        <div className="flex gap-2">
          <Button variant={selectedProjectId ? 'ghost' : 'secondary'} onClick={() => setSelectedProjectId('')}>
            Todos
          </Button>
          {filteredProjects.slice(0, 3).map((project) => (
            <Button
              key={project.id}
              variant={selectedProjectId === project.id ? 'secondary' : 'ghost'}
              onClick={() => setSelectedProjectId(project.id)}
            >
              {project.nome}
            </Button>
          ))}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-3">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <Card key={project.id} className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-bold text-foreground">{project.nome}</p>
                  <p className="mt-2 text-sm text-muted">
                    Separe chamados, modulos, documentos e historicos dentro deste projeto.
                  </p>
                </div>
                {selectedProjectId === project.id ? (
                  <span className="rounded-full border border-accent/30 bg-accent/12 px-3 py-1 text-xs font-semibold text-foreground">
                    Projeto ativo
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 text-sm text-muted">
                <span>ID do projeto: {project.id}</span>
                <span>Escopo ideal: chamados, docs e modulos isolados por projeto</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant={selectedProjectId === project.id ? 'secondary' : 'ghost'}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  {selectedProjectId === project.id ? 'Projeto selecionado' : 'Selecionar projeto'}
                </Button>
                <Link
                  to={`/projects/${project.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-accent/25 bg-accent/8 px-4 text-sm font-semibold text-foreground"
                >
                  Abrir workspace
                </Link>
              </div>
            </Card>
          ))
        ) : (
          <Card className="space-y-3">
            <p className="font-display text-2xl font-bold text-foreground">Nenhum projeto encontrado</p>
            <p className="text-sm text-muted">Cadastre os projetos no SQL Server para eles aparecerem aqui.</p>
          </Card>
        )}
      </section>
    </div>
  )
}
