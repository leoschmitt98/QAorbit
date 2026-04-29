import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useProjectScope } from '@/hooks/use-project-scope'
import { createCatalogProject, deleteCatalogProject, useCatalogProjectsQuery } from '@/services/catalog-api'

export function ProjectsPage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const { selectedProjectId, setSelectedProjectId } = useProjectScope()
  const [search, setSearch] = useState('')
  const [projectMessage, setProjectMessage] = useState(
    String(location.state?.projectDeleteMessage || 'A exclusao de projeto remove locais de teste, modulos e registros vinculados.'),
  )
  const [deletingProjectId, setDeletingProjectId] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; nome: string } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const projectsQuery = useCatalogProjectsQuery()

  const filteredProjects = useMemo(
    () =>
      (projectsQuery.data ?? []).filter((project) =>
        project.nome.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [projectsQuery.data, search],
  )

  if (projectsQuery.isLoading) return <LoadingState />

  async function handleDeleteProject(project: { id: string; nome: string }) {
    setDeletingProjectId(project.id)
    try {
      const summary = await deleteCatalogProject(project.id)
      if (selectedProjectId === project.id) {
        setSelectedProjectId('')
      }

      await queryClient.invalidateQueries({ queryKey: ['catalog-projects'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog-project-portals', project.id] })
      await queryClient.invalidateQueries({ queryKey: ['catalog-modules', project.id] })
      await queryClient.invalidateQueries({ queryKey: ['functional-documents'] })
      await queryClient.invalidateQueries({ queryKey: ['historical-tests'] })
      await queryClient.invalidateQueries({ queryKey: ['test-plans'] })
      await queryClient.invalidateQueries({ queryKey: ['demandas'] })

      setProjectMessage(
        `Projeto ${summary.deletedProjectName} excluido com ${summary.deletedPortals} local(is) de teste, ${summary.deletedModules} modulo(s), ${summary.deletedHistoricalTests} historico(s) e ${summary.deletedTestPlans} test plan(s).`,
      )
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir o projeto.')
    } finally {
      setDeletingProjectId('')
      setProjectToDelete(null)
    }
  }

  async function handleCreateProject() {
    const nome = newProjectName.trim()
    if (!nome) {
      setProjectMessage('Informe o nome do projeto.')
      return
    }

    setIsCreatingProject(true)
    try {
      const created = await createCatalogProject({ nome })
      await queryClient.invalidateQueries({ queryKey: ['catalog-projects'] })
      setSelectedProjectId(created.id)
      setProjectMessage(`Projeto ${created.nome} cadastrado com sucesso.`)
      setNewProjectName('')
      setIsCreateModalOpen(false)
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o projeto.')
    } finally {
      setIsCreatingProject(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Gestao de projetos"
        title="Projetos e frentes monitoradas"
        description="Use esta aba para entrar no contexto de cada produto, separar o workspace por projeto e organizar modulos e documentacao funcional."
        action={<Button onClick={() => setIsCreateModalOpen(true)}>Novo projeto</Button>}
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

      {projectMessage ? (
        <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
          {projectMessage}
        </div>
      ) : null}

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
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-200 hover:bg-red-500/10 hover:text-red-100"
                  onClick={() => setProjectToDelete(project)}
                  disabled={deletingProjectId === project.id}
                >
                  {deletingProjectId === project.id ? 'Excluindo...' : 'Excluir'}
                </Button>
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

      {projectToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#11131a] p-5 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-foreground">Excluir projeto?</h2>
            <p className="mt-3 text-sm text-muted">
              O projeto {projectToDelete.nome} sera excluido e todos os chamados vinculados a ele tambem serao removidos.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setProjectToDelete(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleDeleteProject(projectToDelete)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#11131a] p-5 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-foreground">Novo projeto</h2>
            <p className="mt-3 text-sm text-muted">
              Cadastre um projeto para organizar locais de teste, modulos, chamados, documentos e automacoes.
            </p>
            <label className="mt-5 block space-y-2">
              <span className="text-sm font-semibold text-foreground">Nome do projeto</span>
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreateProject()
                }}
                placeholder="Ex.: Plataforma QA"
                autoFocus
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setNewProjectName('')
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleCreateProject()} disabled={isCreatingProject}>
                {isCreatingProject ? 'Cadastrando...' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
