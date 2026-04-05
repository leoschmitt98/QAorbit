import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import { useFunctionalDocumentsQuery } from '@/services/functional-docs-api'
import { formatDate } from '@/utils/format'

export function FunctionalBasePage() {
  const { selectedProjectId } = useProjectScope()
  const [moduleId, setModuleId] = useState('')
  const [search, setSearch] = useState('')
  const projectsQuery = useCatalogProjectsQuery()
  const modulesQuery = useCatalogModulesQuery(selectedProjectId)
  const documentsQuery = useFunctionalDocumentsQuery({
    projectId: selectedProjectId,
    moduleId,
    search,
  })

  const documents = documentsQuery.data ?? []
  const modules = modulesQuery.data ?? []
  const projects = projectsQuery.data ?? []
  const activeProjectName =
    projects.find((project) => project.id === selectedProjectId)?.nome ?? 'Todos os projetos'

  const filteredDocuments = useMemo(() => documents, [documents])

  if (projectsQuery.isLoading || documentsQuery.isLoading || (selectedProjectId && modulesQuery.isLoading)) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Base funcional"
        title="Documentacao, regras e casos de uso"
        description="Consulte o acervo funcional por projeto e modulo para reutilizar contexto no chamado, no prompt e na analise tecnica."
      />

      <Card className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por titulo, tag, resumo ou versao..."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
            Projeto ativo: <span className="font-semibold text-foreground">{activeProjectName}</span>
          </div>
          <select
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
            disabled={!selectedProjectId}
          >
            <option value="">{selectedProjectId ? 'Todos os modulos' : 'Selecione um projeto no topo'}</option>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.nome}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        {filteredDocuments.length > 0 ? (
          filteredDocuments.map((item) => (
            <Link key={item.id} to={`/functional-base/${item.id}`}>
              <Card className="h-full space-y-4 transition hover:border-accent/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                      {item.type}
                    </span>
                    <h2 className="font-display text-xl font-bold text-foreground">{item.title}</h2>
                  </div>
                  <span className="inline-flex rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-semibold text-foreground">
                    {item.version}
                  </span>
                </div>
                <p className="text-sm text-muted">{item.summary || 'Sem resumo informado.'}</p>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-semibold text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="grid gap-2 text-sm text-muted">
                  <span>Projeto: {item.projectName || item.projectId}</span>
                  <span>Modulo: {item.moduleName || item.moduleId}</span>
                  <span>Atualizado em: {formatDate(item.updatedAt)}</span>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="space-y-3">
            <p className="font-display text-2xl font-bold text-foreground">Nenhum documento encontrado</p>
            <p className="text-sm text-muted">
              Cadastre documentos dentro do workspace do projeto para construir a base funcional por módulo.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}
