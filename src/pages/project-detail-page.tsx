import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useCatalogModulesQuery, useCatalogProjectsQuery, createCatalogModule } from '@/services/catalog-api'
import { uploadFunctionalDocument, useFunctionalDocumentsQuery } from '@/services/functional-docs-api'
import type { DocumentItem } from '@/types/domain'
import { formatDate } from '@/utils/format'

const documentTypes: DocumentItem['type'][] = [
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
  const queryClient = useQueryClient()
  const projectsQuery = useCatalogProjectsQuery()
  const modulesQuery = useCatalogModulesQuery(projectId)
  const documentsQuery = useFunctionalDocumentsQuery({ projectId })

  const [newModuleName, setNewModuleName] = useState('')
  const [moduleMessage, setModuleMessage] = useState('Cadastre os modulos reais do projeto para organizar os chamados por contexto funcional.')
  const [isCreatingModule, setIsCreatingModule] = useState(false)

  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [docType, setDocType] = useState<DocumentItem['type']>('Caso de uso' as DocumentItem['type'])
  const [docVersion, setDocVersion] = useState('v1')
  const [docSummary, setDocSummary] = useState('')
  const [docTags, setDocTags] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docMessage, setDocMessage] = useState('Faça upload de PDF, DOCX ou planilha e vincule o arquivo diretamente ao módulo.')
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)

  const project = (projectsQuery.data ?? []).find((item) => item.id === projectId) ?? null
  const projectName = project?.nome ?? ''
  const modules = modulesQuery.data ?? []
  const documents = documentsQuery.data ?? []

  const modulesWithStats = useMemo(
    () =>
      modules.map((module) => ({
        ...module,
        docsCount: documents.filter((document) => document.moduleId === module.id).length,
      })),
    [documents, modules],
  )

  if (projectsQuery.isLoading || modulesQuery.isLoading || documentsQuery.isLoading) {
    return <LoadingState />
  }

  if (!project) {
    return <LoadingState />
  }

  async function handleCreateModule() {
    if (!newModuleName.trim()) {
      setModuleMessage('Informe o nome do modulo antes de cadastrar.')
      return
    }

    setIsCreatingModule(true)
    try {
      const created = await createCatalogModule({ projetoId: projectId, nome: newModuleName })
      setNewModuleName('')
      setSelectedModuleId(created.id)
      setModuleMessage(`Modulo ${created.nome} cadastrado com sucesso em ${projectName}.`)
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
      setDocMessage('Documento funcional salvo com sucesso e vinculado ao módulo.')
      await queryClient.invalidateQueries({ queryKey: ['functional-documents'] })
    } catch (error) {
      setDocMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o documento funcional.')
    } finally {
      setIsUploadingDoc(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace do projeto"
        title={project.nome}
        description="Organize os modulos reais do projeto e guarde casos de uso, regras de negocio e documentos operacionais em cada modulo."
      />

      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Modulos funcionais</p>
            <h2 className="font-display text-xl font-bold text-foreground">Mapa do projeto</h2>
            <p className="mt-2 text-sm text-muted">
              Cadastre os modulos do projeto para depois relacionar chamados, bugs e documentacao funcional ao lugar certo.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr,auto]">
            <Input
              value={newModuleName}
              onChange={(event) => setNewModuleName(event.target.value)}
              placeholder="Ex.: Boletim, Agenda, Matricula, Notas..."
            />
            <Button onClick={() => void handleCreateModule()} disabled={isCreatingModule}>
              {isCreatingModule ? 'Cadastrando...' : 'Cadastrar modulo'}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
            {moduleMessage}
          </div>

          <div className="space-y-4">
            {modulesWithStats.length > 0 ? (
              modulesWithStats.map((module) => (
                <div key={module.id} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{module.nome}</p>
                      <p className="text-sm text-muted">ID {module.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                        {module.docsCount} doc(s)
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                Nenhum modulo cadastrado ainda para este projeto.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Documentacao por modulo</p>
            <h2 className="font-display text-xl font-bold text-foreground">Upload real de documentos</h2>
            <p className="mt-2 text-sm text-muted">
              Salve caso de uso, regra de negocio, criterio de aceite ou fluxo conhecido direto dentro do modulo.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Modulo</span>
              <select
                value={selectedModuleId}
                onChange={(event) => setSelectedModuleId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
              >
                <option value="">Selecione um modulo</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.nome}
                  </option>
                ))}
              </select>
            </label>

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
              className="min-h-[120px] rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/35"
            />

            <Input
              value={docTags}
              onChange={(event) => setDocTags(event.target.value)}
              placeholder="Tags separadas por virgula: matricula, regra, homologacao"
            />

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Arquivo</span>
              <input
                type="file"
                onChange={(event) => setDocFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-background"
              />
            </label>

            <Button onClick={() => void handleUploadDocument()} disabled={isUploadingDoc}>
              {isUploadingDoc ? 'Salvando documento...' : 'Salvar documento no modulo'}
            </Button>

            <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
              {docMessage}
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Acervo do projeto</p>
            <h2 className="font-display text-xl font-bold text-foreground">Documentos já vinculados</h2>
          </div>
          <Link className="text-sm font-semibold text-accent" to="/functional-base">
            Abrir base funcional
          </Link>
        </div>

        {documents.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {documents.map((document) => (
              <Card key={document.id} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{document.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {document.moduleName || document.moduleId} · {document.type}
                    </p>
                  </div>
                  <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
                    {document.version}
                  </span>
                </div>
                <p className="text-sm text-muted">{document.summary || 'Sem resumo informado.'}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Atualizado em {formatDate(document.updatedAt)}</span>
                  <Link className="font-semibold text-accent" to={`/functional-base/${document.id}`}>
                    Abrir
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="space-y-2">
            <p className="font-semibold text-foreground">Nenhum documento neste projeto</p>
            <p className="text-sm text-muted">
              Assim que você fizer upload de casos de uso e regras de negócio, eles aparecerão aqui organizados por módulo.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}
