import { useMemo, useState } from 'react'
import { ChevronLeft, Folder, FolderOpen, FolderSearch, Play, RefreshCw, Save, Terminal, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useCatalogProjectsQuery } from '@/services/catalog-api'
import {
  chooseQaRunnerDirectory,
  getQaRunnerWorkspace,
  listQaRunnerDirectories,
  listQaRunnerSuites,
  runQaRunnerSuite,
  saveQaRunnerWorkspace,
  useQaRunnerWorkspacesQuery,
  type QaRunnerRunResult,
  type QaRunnerDirectoryEntry,
  type QaRunnerSuite,
} from '@/services/qa-runner-api'

const RESERVED_PARAMS = new Set(['baseUrl', 'username', 'password', 'senha', 'usuario'])

function buildRunPreview(payload: {
  projectId: string
  projectName: string
  workspacePath: string
  suite: QaRunnerSuite | null
  baseUrl: string
  username: string
  password: string
  extraEnv: Record<string, string>
}) {
  return {
    project: {
      id: payload.projectId,
      name: payload.projectName,
    },
    workspacePath: payload.workspacePath,
    suite: payload.suite
      ? {
          id: payload.suite.id,
          name: payload.suite.name,
          spec: payload.suite.spec,
        }
      : null,
    runtime: {
      baseUrl: payload.baseUrl,
      username: payload.username,
      password: payload.password ? '********' : '',
      env: payload.extraEnv,
    },
  }
}

function formatDuration(durationMs: number) {
  if (!durationMs) return '0s'
  if (durationMs < 1000) return `${durationMs}ms`
  return `${Math.round(durationMs / 100) / 10}s`
}

export function QaRunnerPage() {
  const queryClient = useQueryClient()
  const projectsQuery = useCatalogProjectsQuery()
  const workspacesQuery = useQaRunnerWorkspacesQuery()

  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [suites, setSuites] = useState<QaRunnerSuite[]>([])
  const [selectedSuiteId, setSelectedSuiteId] = useState('')
  const [suiteSource, setSuiteSource] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [extraEnv, setExtraEnv] = useState<Record<string, string>>({})
  const [runResult, setRunResult] = useState<QaRunnerRunResult | null>(null)
  const [isLoadingSuites, setIsLoadingSuites] = useState(false)
  const [isDirectoryPickerOpen, setIsDirectoryPickerOpen] = useState(false)
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false)
  const [directoryPath, setDirectoryPath] = useState('')
  const [directoryParentPath, setDirectoryParentPath] = useState('')
  const [directoryEntries, setDirectoryEntries] = useState<QaRunnerDirectoryEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [message, setMessage] = useState('Selecione um projeto e aponte a pasta Cypress usada pelas suites automatizadas.')

  const projects = projectsQuery.data ?? []
  const workspaces = workspacesQuery.data ?? []
  const selectedSuite = suites.find((suite) => suite.id === selectedSuiteId) ?? null
  const dynamicParams = useMemo(
    () => (selectedSuite?.requiredParams ?? []).filter((param) => !RESERVED_PARAMS.has(param)),
    [selectedSuite],
  )

  const runPreview = useMemo(
    () =>
      buildRunPreview({
        projectId,
        projectName,
        workspacePath,
        suite: selectedSuite,
        baseUrl,
        username,
        password,
        extraEnv,
      }),
    [baseUrl, extraEnv, password, projectId, projectName, selectedSuite, username, workspacePath],
  )

  function handleProjectChange(nextProjectId: string) {
    const project = projects.find((item) => item.id === nextProjectId)
    const savedWorkspace = getQaRunnerWorkspace(nextProjectId)

    setProjectId(nextProjectId)
    setProjectName(project?.nome || '')
    setWorkspacePath(savedWorkspace?.workspacePath || '')
    setSuites([])
    setSelectedSuiteId('')
    setSuiteSource('')
    setRunResult(null)
    setMessage(
      savedWorkspace
        ? 'Workspace carregado para este projeto. Busque as suites para atualizar a lista.'
        : 'Informe a pasta onde ficam as suites Cypress deste projeto.',
    )
  }

  async function handleSaveWorkspace() {
    if (!projectId) {
      setMessage('Selecione um projeto antes de salvar o caminho.')
      return
    }

    if (!workspacePath.trim()) {
      setMessage('Informe o caminho da pasta Cypress do projeto.')
      return
    }

    saveQaRunnerWorkspace({
      projectId,
      projectName,
      workspacePath: workspacePath.trim(),
    })
    setMessage('Caminho do workspace salvo para este projeto.')
    await queryClient.invalidateQueries({ queryKey: ['qa-runner-workspaces'] })
  }

  async function handleLoadSuites() {
    if (!workspacePath.trim()) {
      setMessage('Informe o caminho do workspace antes de buscar suites.')
      return
    }

    setIsLoadingSuites(true)
    setRunResult(null)

    try {
      const response = await listQaRunnerSuites(workspacePath.trim())
      setWorkspacePath(response.workspacePath)
      setSuites(response.suites)
      setSelectedSuiteId(response.suites[0]?.id || '')
      setSuiteSource(response.source)
      setMessage(
        response.suites.length
          ? `${response.suites.length} suite(s) encontrada(s) no workspace.`
          : 'Nenhuma suite encontrada. Crie specs em cypress/e2e ou adicione qa-orbit.suites.json.',
      )
    } catch (error) {
      setSuites([])
      setSelectedSuiteId('')
      setSuiteSource('')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel buscar suites.')
    } finally {
      setIsLoadingSuites(false)
    }
  }

  async function loadDirectories(nextPath?: string) {
    setIsLoadingDirectories(true)

    try {
      const response = await listQaRunnerDirectories(nextPath)
      setDirectoryPath(response.currentPath)
      setDirectoryParentPath(response.parentPath)
      setDirectoryEntries(response.entries)
      setMessage('Navegue ate a pasta do workspace Cypress e confirme a selecao.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel listar as pastas.')
    } finally {
      setIsLoadingDirectories(false)
    }
  }

  async function openDirectoryPicker() {
    setIsDirectoryPickerOpen(true)
    await loadDirectories(workspacePath.trim() || undefined)
  }

  async function openNativeDirectoryPicker() {
    setIsLoadingDirectories(true)

    try {
      const response = await chooseQaRunnerDirectory(workspacePath.trim() || undefined)
      if (response.canceled) {
        setMessage('Selecao de pasta cancelada.')
        return
      }

      setWorkspacePath(response.selectedPath)
      setMessage('Pasta selecionada. Agora voce pode salvar o caminho ou buscar as suites.')
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Use o navegador interno de pastas.` : 'Nao foi possivel abrir o seletor nativo.')
      await openDirectoryPicker()
    } finally {
      setIsLoadingDirectories(false)
    }
  }

  function selectCurrentDirectory() {
    if (!directoryPath) {
      setMessage('Selecione uma pasta antes de confirmar.')
      return
    }

    setWorkspacePath(directoryPath)
    setIsDirectoryPickerOpen(false)
    setMessage('Pasta selecionada. Agora voce pode salvar o caminho ou buscar as suites.')
  }

  async function handleRunSuite() {
    if (!projectId) {
      setMessage('Selecione um projeto antes de executar.')
      return
    }

    if (!selectedSuite) {
      setMessage('Selecione uma suite Cypress para executar.')
      return
    }

    if (!baseUrl.trim()) {
      setMessage('Informe a URL que o Cypress deve usar como baseUrl.')
      return
    }

    setIsRunning(true)
    setRunResult(null)
    setMessage('Executando suite Cypress...')

    try {
      const result = await runQaRunnerSuite({
        projectId,
        projectName,
        workspacePath,
        spec: selectedSuite.spec,
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        password,
        extraEnv,
      })
      setRunResult(result)
      setMessage(result.ok ? 'Suite executada com sucesso.' : 'Suite finalizada com falha. Confira o log abaixo.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel executar a suite.')
    } finally {
      setIsRunning(false)
    }
  }

  function updateExtraEnv(key: string, value: string) {
    setExtraEnv((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function loadWorkspace(projectWorkspace: { projectId: string; projectName: string; workspacePath: string }) {
    setProjectId(projectWorkspace.projectId)
    setProjectName(projectWorkspace.projectName)
    setWorkspacePath(projectWorkspace.workspacePath)
    setSuites([])
    setSelectedSuiteId('')
    setSuiteSource('')
    setRunResult(null)
    setMessage('Workspace carregado. Busque as suites para selecionar uma execucao.')
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Automacao"
        title="QA Runner"
        description="Aponte o workspace Cypress do projeto, escolha uma suite automatizada e execute contra a URL e credenciais informadas."
      />

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr),minmax(320px,0.9fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[0.9fr,1.4fr]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Projeto</span>
                <select
                  value={projectId}
                  onChange={(event) => handleProjectChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
                >
                  <option value="">{projectsQuery.isLoading ? 'Carregando...' : 'Selecione um projeto'}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Caminho do workspace Cypress</span>
                <div className="flex gap-2">
                  <Input
                    value={workspacePath}
                    onChange={(event) => setWorkspacePath(event.target.value)}
                    placeholder="C:\\projetos\\qarunner-cypress\\meu-projeto"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 shrink-0 px-3"
                    onClick={() => void openNativeDirectoryPicker()}
                    disabled={isLoadingDirectories}
                    title="Abrir seletor de pastas do Windows"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleSaveWorkspace()}>
                <Save className="mr-2 h-4 w-4" />
                Salvar caminho
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleLoadSuites()} disabled={isLoadingSuites}>
                {isLoadingSuites ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FolderSearch className="mr-2 h-4 w-4" />}
                Buscar suites
              </Button>
              <Button type="button" variant="ghost" onClick={() => void openDirectoryPicker()}>
                Navegar no app
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">{message}</div>
          </Card>

          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Suites disponiveis</p>
                <h2 className="font-display text-xl font-bold text-foreground">Execucao Cypress</h2>
              </div>
              {suiteSource ? <Badge tone="info">{suiteSource === 'manifest' ? 'Manifesto' : 'Scan'}</Badge> : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Suite</span>
                <select
                  value={selectedSuiteId}
                  onChange={(event) => setSelectedSuiteId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
                >
                  <option value="">{suites.length ? 'Selecione uma suite' : 'Busque as suites primeiro'}</option>
                  {suites.map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      {suite.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Base URL</span>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://cliente.exemplo.com" />
              </label>
            </div>

            {selectedSuite ? (
              <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                <p className="font-semibold text-foreground">{selectedSuite.name}</p>
                <p className="mt-1">{selectedSuite.spec}</p>
                {selectedSuite.description ? <p className="mt-2">{selectedSuite.description}</p> : null}
                {selectedSuite.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSuite.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Usuario</span>
                <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Opcional" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Senha</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Opcional" />
              </label>
            </div>

            {dynamicParams.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {dynamicParams.map((param) => (
                  <label key={param} className="space-y-2">
                    <span className="text-sm font-semibold text-foreground">{param}</span>
                    <Input value={extraEnv[param] || ''} onChange={(event) => updateExtraEnv(param, event.target.value)} placeholder="Valor usado pela suite" />
                  </label>
                ))}
              </div>
            ) : null}

            <Button type="button" onClick={() => void handleRunSuite()} disabled={isRunning}>
              {isRunning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Executar suite
            </Button>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Retorno do Cypress</p>
                <h2 className="font-display text-xl font-bold text-foreground">Log da execucao</h2>
              </div>
              {runResult ? (
                <Badge tone={runResult.ok ? 'success' : 'danger'}>
                  {runResult.status} em {formatDuration(runResult.durationMs)}
                </Badge>
              ) : null}
            </div>

            {runResult ? (
              <div className="space-y-3">
                <div className="max-w-full break-all rounded-2xl border border-border bg-black/20 p-3 text-xs text-muted">{runResult.command}</div>
                <pre className="max-h-[420px] max-w-full overflow-auto whitespace-pre rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
                  {[runResult.stdout, runResult.stderr, runResult.error].filter(Boolean).join('\n')}
                </pre>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                O log aparece aqui depois da primeira execucao.
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Payload de execucao</p>
              <h2 className="font-display text-xl font-bold text-foreground">Preview</h2>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
              {JSON.stringify(runPreview, null, 2)}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Workspaces salvos</p>
              <h2 className="font-display text-xl font-bold text-foreground">Projetos mapeados</h2>
            </div>

            <div className="space-y-3">
              {workspaces.length > 0 ? (
                workspaces.map((workspace) => (
                  <div key={workspace.projectId} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{workspace.projectName || 'Projeto sem nome'}</p>
                        <p className="mt-1 break-all text-sm text-muted">{workspace.workspacePath}</p>
                      </div>
                      <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => loadWorkspace(workspace)}>
                        Carregar
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                  Nenhum workspace salvo ainda.
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" />
              <h2 className="font-display text-xl font-bold text-foreground">Manifesto opcional</h2>
            </div>
            <p className="text-sm text-muted">
              Se existir um arquivo qa-orbit.suites.json na raiz do workspace, o QA Runner usa ele para nomear suites e pedir parametros extras.
            </p>
            <pre className="max-w-full overflow-x-auto whitespace-pre rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
{`{
  "projectKey": "meu-projeto",
  "projectName": "Meu projeto",
  "suites": [
    {
      "id": "login-admin",
      "name": "Login admin",
      "spec": "cypress/e2e/login-admin.cy.js",
      "requiredParams": ["baseUrl", "username", "password"]
    }
  ]
}`}
            </pre>
          </Card>
        </div>
      </section>

      {isDirectoryPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-border bg-panel p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Selecionar pasta</p>
                <h2 className="font-display text-xl font-bold text-foreground">Workspace Cypress</h2>
              </div>
              <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setIsDirectoryPickerOpen(false)} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-black/20 p-3 text-sm text-muted">
              {directoryPath || 'Selecione uma unidade'}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadDirectories(directoryParentPath || undefined)}
                disabled={isLoadingDirectories || (!directoryParentPath && Boolean(directoryPath))}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button type="button" onClick={selectCurrentDirectory} disabled={!directoryPath}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Usar esta pasta
              </Button>
            </div>

            <div className="mt-4 max-h-[420px] overflow-auto rounded-2xl border border-border bg-white/[0.02] p-2">
              {isLoadingDirectories ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Carregando pastas...
                </div>
              ) : directoryEntries.length ? (
                directoryEntries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => void loadDirectories(entry.path)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent/10"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0 truncate">{entry.name}</span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-muted">Nenhuma subpasta encontrada aqui.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
