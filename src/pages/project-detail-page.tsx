import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useProjectScope } from '@/hooks/use-project-scope'
import {
  createCatalogModule,
  createCatalogProjectPortal,
  deleteCatalogProject,
  useCatalogModulesQuery,
  useCatalogProjectPortalsQuery,
  useCatalogProjectsQuery,
} from '@/services/catalog-api'
import { uploadFunctionalDocument, useFunctionalDocumentsQuery } from '@/services/functional-docs-api'
import type { DocumentItem } from '@/types/domain'
import { formatDate } from '@/utils/format'

const documentTypes: DocumentItem['type'][] = [
  'Caso de uso',
  'Regra de negocio',
  'Documento funcional',
  'Criterio de aceite',
  'Fluxo conhecido',
]

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedProjectId, setSelectedProjectId } = useProjectScope()

  const projectsQuery = useCatalogProjectsQuery()
  const portalsQuery = useCatalogProjectPortalsQuery(projectId)
  const modulesQuery = useCatalogModulesQuery(projectId)
  const documentsQuery = useFunctionalDocumentsQuery({ projectId })

  const [newPortalName, setNewPortalName] = useState('')
  const [portalMessage, setPortalMessage] = useState('Crie os portais ou areas macro do projeto antes de distribuir os modulos dentro deles.')
  const [isCreatingPortal, setIsCreatingPortal] = useState(false)

  const [newModuleName, setNewModuleName] = useState('')
  const [newModulePortalId, setNewModulePortalId] = useState('')
  const [moduleMessage, setModuleMessage] = useState('Cadastre os modulos reais dentro do portal correspondente para espelhar o repositorio funcional do projeto.')
  const [isCreatingModule, setIsCreatingModule] = useState(false)
  const [collapsedPortalIds, setCollapsedPortalIds] = useState<string[]>([])
  const [inlineUploadModuleId, setInlineUploadModuleId] = useState('')

  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [docType, setDocType] = useState<DocumentItem['type']>('Caso de uso')
  const [docVersion, setDocVersion] = useState('v1')
  const [docSummary, setDocSummary] = useState('')
  const [docTags, setDocTags] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docMessage, setDocMessage] = useState('Vincule PDFs, DOCX ou planilhas ao modulo certo para a IA usar a base funcional do projeto.')
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState(
    'Esta acao remove o projeto, portais, modulos, documentos, chamados, bugs, historicos e test plans vinculados.',
  )
  const [isDeletingProject, setIsDeletingProject] = useState(false)

  const project = (projectsQuery.data ?? []).find((item) => item.id === projectId) ?? null
  const projectName = project?.nome ?? ''
  const portals = portalsQuery.data ?? []
  const modules = modulesQuery.data ?? []
  const documents = documentsQuery.data ?? []

  const modulesByPortal = useMemo(() => {
    const countsByModuleId = new Map<string, number>()
    documents.forEach((document) => {
      countsByModuleId.set(document.moduleId, (countsByModuleId.get(document.moduleId) ?? 0) + 1)
    })

    const modulesWithStats = modules.map((module) => ({
      ...module,
      docsCount: countsByModuleId.get(module.id) ?? 0,
    }))

    return [
      ...portals.map((portal) => ({
        id: portal.id,
        nome: portal.nome,
        modules: modulesWithStats.filter((module) => module.portalId === portal.id),
      })),
      {
        id: 'sem-portal',
        nome: 'Sem portal definido',
        modules: modulesWithStats.filter((module) => !module.portalId),
      },
    ].filter((group) => group.modules.length > 0 || group.id !== 'sem-portal')
  }, [documents, modules, portals])

  const documentsByModuleId = useMemo(() => {
    const map = new Map<string, DocumentItem[]>()
    documents.forEach((document) => {
      const current = map.get(document.moduleId) ?? []
      current.push(document)
      map.set(document.moduleId, current)
    })
    return map
  }, [documents])

  if (projectsQuery.isLoading || portalsQuery.isLoading || modulesQuery.isLoading || documentsQuery.isLoading) {
    return <LoadingState />
  }

  if (!project) {
    return <LoadingState />
  }

  async function handleCreatePortal() {
    if (!newPortalName.trim()) {
      setPortalMessage('Informe o nome do portal/area antes de cadastrar.')
      return
    }

    setIsCreatingPortal(true)
    try {
      const created = await createCatalogProjectPortal({ projetoId: projectId, nome: newPortalName.trim() })
      setNewPortalName('')
      setNewModulePortalId(created.id)
      setPortalMessage(`Escopo ${created.nome} criado com sucesso dentro de ${projectName}.`)
      await queryClient.invalidateQueries({ queryKey: ['catalog-project-portals', projectId] })
      await queryClient.invalidateQueries({ queryKey: ['catalog-modules', projectId] })
    } catch (error) {
      setPortalMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o portal do projeto.')
    } finally {
      setIsCreatingPortal(false)
    }
  }

  async function handleCreateModule() {
    if (!newModuleName.trim()) {
      setModuleMessage('Informe o nome do modulo antes de cadastrar.')
      return
    }

    setIsCreatingModule(true)
    try {
      const created = await createCatalogModule({
        projetoId: projectId,
        nome: newModuleName.trim(),
        portalId: newModulePortalId || undefined,
      })
      setNewModuleName('')
      setSelectedModuleId(created.id)
      setModuleMessage(`Modulo ${created.nome} cadastrado com sucesso no mapa do projeto.`)
      await queryClient.invalidateQueries({ queryKey: ['catalog-modules', projectId] })
    } catch (error) {
      setModuleMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o modulo.')
    } finally {
      setIsCreatingModule(false)
    }
  }

  async function handleUploadDocument() {
    if (!selectedModuleId) {
      setDocMessage('Selecione o modulo antes de enviar o documento.')
      return
    }

    if (!docTitle.trim() || !docFile) {
      setDocMessage('Informe titulo e arquivo para salvar o documento.')
      return
    }

    setIsUploadingDoc(true)
    try {
      const selectedModule = modules.find((module) => module.id === selectedModuleId)
      const fileDataUrl = await fileToDataUrl(docFile)

      await uploadFunctionalDocument({
        title: docTitle.trim(),
        type: docType,
        projectId,
        projectName,
        moduleId: selectedModuleId,
        moduleName: selectedModule?.nome || selectedModuleId,
        version: docVersion.trim() || 'v1',
        summary: docSummary.trim(),
        tags: docTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        author: 'QA Orbit',
        fileName: docFile.name,
        fileDataUrl,
      })

      setDocTitle('')
      setDocVersion('v1')
      setDocSummary('')
      setDocTags('')
      setDocFile(null)
      setDocMessage('Documento funcional salvo com sucesso no modulo selecionado.')
      setInlineUploadModuleId(selectedModuleId)
      await queryClient.invalidateQueries({ queryKey: ['functional-documents'] })
    } catch (error) {
      setDocMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o documento funcional.')
    } finally {
      setIsUploadingDoc(false)
    }
  }

  async function handleDeleteProject() {
    const confirmation = window.prompt(
      `Para excluir "${projectName}" e todos os dados vinculados, digite exatamente o nome do projeto.`,
    )

    if (confirmation === null) return

    if (confirmation.trim() !== projectName) {
      setDeleteMessage('Nome digitado diferente do projeto. Nada foi excluido.')
      return
    }

    setIsDeletingProject(true)
    try {
      const summary = await deleteCatalogProject(projectId)
      if (selectedProjectId === projectId) {
        setSelectedProjectId('')
      }

      await queryClient.invalidateQueries({ queryKey: ['catalog-projects'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog-project-portals', projectId] })
      await queryClient.invalidateQueries({ queryKey: ['catalog-modules', projectId] })
      await queryClient.invalidateQueries({ queryKey: ['functional-documents'] })
      await queryClient.invalidateQueries({ queryKey: ['historical-tests'] })
      await queryClient.invalidateQueries({ queryKey: ['test-plans'] })
      await queryClient.invalidateQueries({ queryKey: ['demandas'] })

      navigate('/projects', {
        replace: true,
        state: {
          projectDeleteMessage: `Projeto ${summary.deletedProjectName} excluido com ${summary.deletedPortals} portal(is), ${summary.deletedModules} modulo(s), ${summary.deletedHistoricalTests} historico(s) e ${summary.deletedTestPlans} test plan(s).`,
        },
      })
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir o projeto.')
    } finally {
      setIsDeletingProject(false)
    }
  }

  function togglePortal(portalId: string) {
    setCollapsedPortalIds((current) =>
      current.includes(portalId) ? current.filter((item) => item !== portalId) : [...current, portalId],
    )
  }

  function openInlineUpload(moduleId: string) {
    setSelectedModuleId(moduleId)
    setInlineUploadModuleId(moduleId)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace do projeto"
        title={project.nome}
        description="Monte um escopo funcional parecido com repositorio: portais do projeto, modulos dentro de cada portal e documentos vinculados ao lugar certo."
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Estrutura do projeto</p>
            <h2 className="font-display text-xl font-bold text-foreground">Explorer funcional</h2>
            <p className="mt-2 text-sm text-muted">
              Organize o projeto em um formato proximo de IDE: primeiro o portal, depois os modulos e, por fim, a documentacao funcional ligada a cada modulo.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr,auto]">
            <Input
              value={newPortalName}
              onChange={(event) => setNewPortalName(event.target.value)}
              placeholder="Ex.: Portal do aluno, Portal do professor, Portal da secretaria"
            />
            <Button onClick={() => void handleCreatePortal()} disabled={isCreatingPortal}>
              {isCreatingPortal ? 'Criando...' : 'Criar portal'}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">{portalMessage}</div>

          <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr,auto]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Portal/escopo</span>
              <select
                value={newModulePortalId}
                onChange={(event) => setNewModulePortalId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
              >
                <option value="">Sem portal definido</option>
                {portals.map((portal) => (
                  <option key={portal.id} value={portal.id}>
                    {portal.nome}
                  </option>
                ))}
              </select>
            </label>

            <Input
              value={newModuleName}
              onChange={(event) => setNewModuleName(event.target.value)}
              placeholder="Ex.: Digitacao de notas, Configurar modelos, Diario de classe"
            />

            <Button onClick={() => void handleCreateModule()} disabled={isCreatingModule}>
              {isCreatingModule ? 'Cadastrando...' : 'Cadastrar modulo'}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">{moduleMessage}</div>

          <div className="space-y-3">
            {modulesByPortal.length > 0 ? (
              modulesByPortal.map((group) => (
                <div key={group.id} className="rounded-3xl border border-border bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Portal</p>
                      <p className="font-semibold text-foreground">{group.nome}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                        {group.modules.length} modulo(s)
                      </span>
                      <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => togglePortal(group.id)}>
                        {collapsedPortalIds.includes(group.id) ? 'Expandir' : 'Retrair'}
                      </Button>
                    </div>
                  </div>

                  {!collapsedPortalIds.includes(group.id) ? (
                    <div className="mt-4 space-y-3 border-l border-accent/20 pl-4">
                      {group.modules.map((module) => {
                        const moduleDocuments = documentsByModuleId.get(module.id) ?? []

                        return (
                          <div key={module.id} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="font-semibold text-foreground">{module.nome}</p>
                                <p className="text-sm text-muted">ID {module.id}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                                  {module.docsCount} doc(s)
                                </span>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-9 px-3"
                                    onClick={() => openInlineUpload(module.id)}
                                  >
                                  Upload de doc
                                </Button>
                              </div>
                            </div>

                            {moduleDocuments.length > 0 ? (
                              <div className="mt-4 space-y-2">
                                {moduleDocuments.map((document) => (
                                  <div
                                    key={document.id}
                                    className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-black/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{document.title}</p>
                                      <p className="text-xs text-muted">
                                        {document.type} · {document.version} · {formatDate(document.updatedAt)}
                                      </p>
                                    </div>
                                    <Link className="text-sm font-semibold text-accent" to={`/functional-base/${document.id}`}>
                                      Abrir
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-4 rounded-2xl border border-dashed border-border bg-black/10 px-4 py-3 text-sm text-muted">
                                Nenhum documento vinculado ainda a este modulo.
                              </div>
                            )}

                            {inlineUploadModuleId === module.id ? (
                              <div className="mt-4 rounded-3xl border border-accent/20 bg-accent/5 p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm text-muted">Upload no modulo</p>
                                    <p className="font-semibold text-foreground">{module.nome}</p>
                                  </div>
                                  <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setInlineUploadModuleId('')}>
                                    Fechar
                                  </Button>
                                </div>

                                <div className="grid gap-4">
                                  <Input value={docTitle} onChange={(event) => setDocTitle(event.target.value)} placeholder="Titulo do documento" />

                                  <div className="grid gap-4 lg:grid-cols-2">
                                    <label className="space-y-2">
                                      <span className="text-sm font-semibold text-foreground">Tipo</span>
                                      <select
                                        value={docType}
                                        onChange={(event) => setDocType(event.target.value as DocumentItem['type'])}
                                        className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                                      >
                                        {documentTypes.map((type) => (
                                          <option key={type} value={type}>
                                            {type}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="space-y-2">
                                      <span className="text-sm font-semibold text-foreground">Versao</span>
                                      <Input value={docVersion} onChange={(event) => setDocVersion(event.target.value)} placeholder="v1" />
                                    </label>
                                  </div>

                                  <textarea
                                    value={docSummary}
                                    onChange={(event) => setDocSummary(event.target.value)}
                                    placeholder="Resumo curto do conteudo e da utilidade do documento..."
                                    className="min-h-[110px] rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/35"
                                  />

                                  <Input
                                    value={docTags}
                                    onChange={(event) => setDocTags(event.target.value)}
                                    placeholder="Tags separadas por virgula: notas, avaliacao, diario, regra"
                                  />

                                  <label className="space-y-2">
                                    <span className="text-sm font-semibold text-foreground">Arquivo</span>
                                    <input
                                      type="file"
                                      onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
                                      className="block w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-background"
                                    />
                                  </label>

                                  <div className="flex flex-wrap gap-3">
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        setSelectedModuleId(module.id)
                                        void handleUploadDocument()
                                      }}
                                      disabled={isUploadingDoc}
                                    >
                                      {isUploadingDoc && selectedModuleId === module.id ? 'Salvando documento...' : 'Salvar documento'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => {
                                        setDocTitle('')
                                        setDocVersion('v1')
                                        setDocSummary('')
                                        setDocTags('')
                                        setDocFile(null)
                                      }}
                                    >
                                      Limpar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                Nenhum portal ou modulo cadastrado ainda para este projeto.
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Atalho de organizacao</p>
              <h2 className="font-display text-xl font-bold text-foreground">Como usar este mapa</h2>
            </div>
            <div className="space-y-3 text-sm text-muted">
              <p>1. Crie os portais principais do projeto, como Aluno, Professor ou Secretaria.</p>
              <p>2. Cadastre os modulos dentro de cada portal para espelhar a estrutura funcional do sistema.</p>
              <p>3. Dentro de cada modulo, use `Upload de doc` para anexar casos de uso, regras de negocio e fluxos.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">{docMessage}</div>
          </Card>

          <Card className="space-y-4 border-red-500/30 bg-red-500/[0.04]">
            <div>
              <p className="text-sm text-red-200/80">Zona critica</p>
              <h2 className="font-display text-xl font-bold text-foreground">Excluir projeto</h2>
              <p className="mt-2 text-sm text-muted">
                Remove tambem os portais, modulos, documentos funcionais, chamados/retestes, bugs, historicos, demandas e planos de teste ligados a este projeto.
              </p>
            </div>
            <div className="rounded-2xl border border-red-500/20 bg-black/20 p-4 text-sm text-muted">{deleteMessage}</div>
            <Button
              type="button"
              variant="secondary"
              className="border-red-500/40 text-red-100 hover:border-red-400/70 hover:bg-red-500/10"
              onClick={() => void handleDeleteProject()}
              disabled={isDeletingProject}
            >
              {isDeletingProject ? 'Excluindo projeto...' : 'Excluir projeto'}
            </Button>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Acervo do projeto</p>
                <h2 className="font-display text-xl font-bold text-foreground">Documentos ja vinculados</h2>
              </div>
              <Link className="text-sm font-semibold text-accent" to="/functional-base">
                Abrir base funcional
              </Link>
            </div>

            {documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{document.title}</p>
                        <p className="text-sm text-muted">
                          {document.portalName ? `${document.portalName} / ` : ''}
                          {document.moduleName || document.moduleId} · {document.type}
                        </p>
                        <p className="text-sm text-muted">{document.summary || 'Sem resumo informado.'}</p>
                      </div>
                      <div className="space-y-2 text-right">
                        <span className="inline-flex rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                          {document.version}
                        </span>
                        <p className="text-xs text-muted">Atualizado em {formatDate(document.updatedAt)}</p>
                        <Link className="text-sm font-semibold text-accent" to={`/functional-base/${document.id}`}>
                          Abrir
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                Nenhum documento neste projeto ainda. Assim que voce subir casos de uso e regras de negocio, eles aparecerao organizados por portal e modulo.
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}
