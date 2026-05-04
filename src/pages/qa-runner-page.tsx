import { useMemo, useState } from 'react'
import { CheckSquare, ChevronLeft, Folder, FolderOpen, FolderSearch, Play, RefreshCw, Save, Square, Terminal, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { QuickTutorial } from '@/components/ui/quick-tutorial'
import { SectionHeader } from '@/components/ui/section-header'
import { saveQaRunnerFailureHandoff } from '@/services/automation-handoff'
import { useCatalogProjectsQuery } from '@/services/catalog-api'
import {
  chooseQaRunnerDirectory,
  getQaRunnerWorkspace,
  listQaRunnerDirectories,
  listQaRunnerSuites,
  runQaRunnerSuite,
  runQaRunnerSuites,
  saveQaRunnerWorkspace,
  useQaRunnerWorkspacesQuery,
  type QaRunnerBatchRunItem,
  type QaRunnerBatchRunResult,
  type QaRunnerRunResult,
  type QaRunnerDirectoryEntry,
  type QaRunnerSuite,
} from '@/services/qa-runner-api'

const RESERVED_PARAMS = new Set(['baseUrl', 'username', 'password', 'senha', 'usuario'])
const quickSteps = [
  {
    title: 'Selecione o projeto',
    description: 'Carregue o workspace salvo ou informe a pasta onde ficam as suites Cypress do projeto.',
  },
  {
    title: 'Marque suites por modulo',
    description: 'Busque as suites, navegue pelos modulos e marque os testes que deseja rodar em lote.',
  },
  {
    title: 'Preencha parametros',
    description: 'Informe base URL, credenciais e variaveis adicionais que as suites selecionadas precisam.',
  },
  {
    title: 'Execute e corrija',
    description: 'Rode as suites marcadas e, se alguma falhar, abra a correcao assistida com o contexto pronto.',
  },
]

function getSuiteModuleLabel(spec: string) {
  const normalizedSpec = String(spec || '').replace(/\\/g, '/')
  const parts = normalizedSpec.split('/').filter(Boolean)
  const e2eIndex = parts.findIndex((part) => part === 'e2e')
  if (e2eIndex >= 0 && parts[e2eIndex + 1]) return parts[e2eIndex + 1]
  return 'sem-modulo'
}

function getSuiteSubpathLabel(spec: string) {
  const normalizedSpec = String(spec || '').replace(/\\/g, '/')
  const parts = normalizedSpec.split('/').filter(Boolean)
  const e2eIndex = parts.findIndex((part) => part === 'e2e')
  if (e2eIndex >= 0) {
    return parts.slice(e2eIndex + 1).join(' / ')
  }

  return normalizedSpec
}

function buildRunPreview(payload: {
  projectId: string
  projectName: string
  workspacePath: string
  suites: QaRunnerSuite[]
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
    suites: payload.suites.map((suite) => ({
      id: suite.id,
      name: suite.name,
      spec: suite.spec,
      module: getSuiteModuleLabel(suite.spec),
    })),
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

function buildBatchLog(batchRunResult: QaRunnerBatchRunResult) {
  return batchRunResult.results
    .map((result) => {
      const chunks = [result.stdout, result.stderr, result.error].filter(Boolean).join('\n')
      return [
        `### ${result.suiteName} (${result.status.toUpperCase()})`,
        `Spec: ${result.spec}`,
        `Duracao: ${formatDuration(result.durationMs)}`,
        chunks || 'Sem log retornado.',
      ].join('\n')
    })
    .join('\n\n')
}

export function QaRunnerPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectsQuery = useCatalogProjectsQuery()
  const workspacesQuery = useQaRunnerWorkspacesQuery()

  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [suites, setSuites] = useState<QaRunnerSuite[]>([])
  const [selectedSuiteId, setSelectedSuiteId] = useState('')
  const [checkedSuiteIds, setCheckedSuiteIds] = useState<string[]>([])
  const [suiteSource, setSuiteSource] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [extraEnv, setExtraEnv] = useState<Record<string, string>>({})
  const [runResult, setRunResult] = useState<QaRunnerRunResult | null>(null)
  const [batchRunResult, setBatchRunResult] = useState<QaRunnerBatchRunResult | null>(null)
  const [isLoadingSuites, setIsLoadingSuites] = useState(false)
  const [isDirectoryPickerOpen, setIsDirectoryPickerOpen] = useState(false)
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false)
  const [directoryPath, setDirectoryPath] = useState('')
  const [directoryParentPath, setDirectoryParentPath] = useState('')
  const [directoryEntries, setDirectoryEntries] = useState<QaRunnerDirectoryEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [message, setMessage] = useState('Selecione um projeto e aponte a pasta Cypress usada pelas suites automatizadas.')
  const [messageTone, setMessageTone] = useState<'neutral' | 'success' | 'danger'>('neutral')

  const projects = projectsQuery.data ?? []
  const workspaces = workspacesQuery.data ?? []
  const selectedSuite = suites.find((suite) => suite.id === selectedSuiteId) ?? null
  const checkedSuites = useMemo(
    () => suites.filter((suite) => checkedSuiteIds.includes(suite.id)),
    [checkedSuiteIds, suites],
  )
  const suitesToRun = checkedSuites.length ? checkedSuites : selectedSuite ? [selectedSuite] : []
  const dynamicParams = useMemo(() => {
    const collected = new Set<string>()

    for (const suite of suitesToRun) {
      for (const param of suite.requiredParams ?? []) {
        if (!RESERVED_PARAMS.has(param)) {
          collected.add(param)
        }
      }
    }

    return Array.from(collected)
  }, [suitesToRun])

  const groupedSuites = useMemo(() => {
    const groups = new Map<string, QaRunnerSuite[]>()

    for (const suite of suites) {
      const moduleLabel = getSuiteModuleLabel(suite.spec)
      const current = groups.get(moduleLabel) ?? []
      current.push(suite)
      groups.set(moduleLabel, current)
    }

    return Array.from(groups.entries())
      .map(([moduleLabel, moduleSuites]) => ({
        moduleLabel,
        suites: [...moduleSuites].sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .sort((left, right) => left.moduleLabel.localeCompare(right.moduleLabel))
  }, [suites])

  const executionIssues = useMemo(() => {
    const issues: string[] = []

    if (!projectId) issues.push('Selecione um projeto.')
    if (!workspacePath.trim()) issues.push('Informe ou carregue o caminho do workspace Cypress.')
    if (!suites.length) issues.push('Busque as suites do workspace antes de executar.')
    if (!suitesToRun.length) issues.push('Selecione uma suite ou marque as suites que deseja rodar.')
    if (!baseUrl.trim()) issues.push('Preencha a Base URL.')

    for (const param of dynamicParams) {
      if (!String(extraEnv[param] || '').trim()) {
        issues.push(`Preencha o parametro obrigatorio "${param}".`)
      }
    }

    return issues
  }, [baseUrl, dynamicParams, extraEnv, projectId, suites.length, suitesToRun.length, workspacePath])

  const runPreview = useMemo(
    () =>
      buildRunPreview({
        projectId,
        projectName,
        workspacePath,
        suites: suitesToRun,
        baseUrl,
        username,
        password,
        extraEnv,
      }),
    [baseUrl, extraEnv, password, projectId, projectName, suitesToRun, username, workspacePath],
  )
  const currentTutorialStep = useMemo(() => {
    if (runResult || batchRunResult) return 3
    if (suitesToRun.length && baseUrl.trim()) return 2
    if (suites.length) return 1
    return 0
  }, [baseUrl, batchRunResult, runResult, suites.length, suitesToRun.length])

  const latestFailedResult = useMemo(() => {
    if (batchRunResult?.results?.length) {
      return batchRunResult.results.find((result) => !result.ok) ?? null
    }

    if (runResult && !runResult.ok && selectedSuite) {
      return {
        suiteId: selectedSuite.id,
        suiteName: selectedSuite.name,
        ...runResult,
      } satisfies QaRunnerBatchRunItem
    }

    return null
  }, [batchRunResult, runResult, selectedSuite])

  function handleProjectChange(nextProjectId: string) {
    const project = projects.find((item) => item.id === nextProjectId)
    const savedWorkspace = getQaRunnerWorkspace(nextProjectId)

    setProjectId(nextProjectId)
    setProjectName(project?.nome || '')
    setWorkspacePath(savedWorkspace?.workspacePath || '')
    setSuites([])
    setSelectedSuiteId('')
    setCheckedSuiteIds([])
    setSuiteSource('')
    setRunResult(null)
    setBatchRunResult(null)
    setMessageTone('neutral')
    setMessage(
      savedWorkspace
        ? 'Workspace carregado para este projeto. Busque as suites para atualizar a lista.'
        : 'Informe a pasta onde ficam as suites Cypress deste projeto.',
    )
  }

  async function handleSaveWorkspace() {
    if (!projectId) {
      setMessage('Selecione um projeto antes de salvar o caminho.')
      setMessageTone('danger')
      return
    }

    if (!workspacePath.trim()) {
      setMessage('Informe o caminho da pasta Cypress do projeto.')
      setMessageTone('danger')
      return
    }

    saveQaRunnerWorkspace({
      projectId,
      projectName,
      workspacePath: workspacePath.trim(),
    })
    setMessage('Caminho do workspace salvo para este projeto.')
    setMessageTone('success')
    await queryClient.invalidateQueries({ queryKey: ['qa-runner-workspaces'] })
  }

  async function handleLoadSuites() {
    if (!workspacePath.trim()) {
      setMessage('Informe o caminho do workspace antes de buscar suites.')
      setMessageTone('danger')
      return
    }

    setIsLoadingSuites(true)
    setRunResult(null)
    setBatchRunResult(null)

    try {
      const response = await listQaRunnerSuites(workspacePath.trim())
      setWorkspacePath(response.workspacePath)
      setSuites(response.suites)
      setSelectedSuiteId(response.suites[0]?.id || '')
      setCheckedSuiteIds([])
      setSuiteSource(response.source)
      setMessage(
        response.suites.length
          ? `${response.suites.length} suite(s) encontrada(s) no workspace. Agora voce pode marcar por modulo e executar em lote.`
          : 'Nenhuma suite encontrada. Crie specs em cypress/e2e ou adicione qa-orbit.suites.json.',
      )
      setMessageTone(response.suites.length ? 'success' : 'danger')
    } catch (error) {
      setSuites([])
      setSelectedSuiteId('')
      setCheckedSuiteIds([])
      setSuiteSource('')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel buscar suites.')
      setMessageTone('danger')
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
      setMessageTone('neutral')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel listar as pastas.')
      setMessageTone('danger')
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
        setMessageTone('neutral')
        return
      }

      setWorkspacePath(response.selectedPath)
      setMessage('Pasta selecionada. Agora voce pode salvar o caminho ou buscar as suites.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Use o navegador interno de pastas.` : 'Nao foi possivel abrir o seletor nativo.')
      setMessageTone('danger')
      await openDirectoryPicker()
    } finally {
      setIsLoadingDirectories(false)
    }
  }

  function selectCurrentDirectory() {
    if (!directoryPath) {
      setMessage('Selecione uma pasta antes de confirmar.')
      setMessageTone('danger')
      return
    }

    setWorkspacePath(directoryPath)
    setIsDirectoryPickerOpen(false)
    setMessage('Pasta selecionada. Agora voce pode salvar o caminho ou buscar as suites.')
    setMessageTone('success')
  }

  function toggleSuite(suiteId: string) {
    setCheckedSuiteIds((current) => (
      current.includes(suiteId)
        ? current.filter((id) => id !== suiteId)
        : [...current, suiteId]
    ))
  }

  function toggleModuleSuites(moduleSuites: QaRunnerSuite[]) {
    const moduleIds = moduleSuites.map((suite) => suite.id)
    const allChecked = moduleIds.every((suiteId) => checkedSuiteIds.includes(suiteId))

    setCheckedSuiteIds((current) => {
      if (allChecked) {
        return current.filter((suiteId) => !moduleIds.includes(suiteId))
      }

      return Array.from(new Set([...current, ...moduleIds]))
    })
  }

  async function handleRunSuites() {
    if (executionIssues.length) {
      setMessage(`Nao foi possivel iniciar a execucao. ${executionIssues[0]}`)
      setMessageTone('danger')
      return
    }

    setIsRunning(true)
    setRunResult(null)
    setBatchRunResult(null)
    setMessageTone('neutral')
    setMessage(
      suitesToRun.length > 1
        ? `Executando ${suitesToRun.length} suites Cypress em sequencia...`
        : 'Executando suite Cypress...',
    )

    try {
      if (suitesToRun.length === 1) {
        const suite = suitesToRun[0]
        const result = await runQaRunnerSuite({
          projectId,
          projectName,
          workspacePath,
          spec: suite.spec,
          baseUrl: baseUrl.trim(),
          username: username.trim(),
          password,
          extraEnv,
        })
        setRunResult(result)
        setMessage(result.ok ? 'Suite executada com sucesso.' : 'Suite finalizada com falha. Confira o log abaixo.')
        setMessageTone(result.ok ? 'success' : 'danger')
        return
      }

      const result = await runQaRunnerSuites({
        projectId,
        projectName,
        workspacePath,
        suites: suitesToRun.map((suite) => ({
          id: suite.id,
          name: suite.name,
          spec: suite.spec,
        })),
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        password,
        extraEnv,
      })

      setBatchRunResult(result)
      setMessage(
        result.ok
          ? `${result.passedSuites} suite(s) executada(s) com sucesso.`
          : `${result.failedSuites} suite(s) falharam. Revise o resumo e os logs abaixo.`,
      )
      setMessageTone(result.ok ? 'success' : 'danger')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel executar as suites.')
      setMessageTone('danger')
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
    setCheckedSuiteIds([])
    setSuiteSource('')
    setRunResult(null)
    setBatchRunResult(null)
    setMessage('Workspace carregado. Busque as suites para selecionar uma execucao.')
    setMessageTone('success')
  }

  function handleOpenInAutomationBuilder() {
    if (!latestFailedResult) return

    const failedSuite = suites.find((suite) => suite.spec === latestFailedResult.spec || suite.id === latestFailedResult.suiteId) ?? selectedSuite
    if (!failedSuite) return

    saveQaRunnerFailureHandoff({
      projectName,
      suite: failedSuite,
      baseUrl,
      workspacePath,
      runResult: latestFailedResult,
    })
    navigate('/automation/cypress-builder')
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Automacao"
        title="QA Runner"
        description="Aponte o workspace Cypress do projeto, marque suites por modulo e execute uma bateria inteira sem sair do QA Orbit."
      />

      <QuickTutorial
        title="Como usar esta aba"
        description="Agora o QA Runner ajuda a organizar a bateria por modulo: voce marca as suites que quiser, executa tudo em lote e leva a primeira falha direto para a correcao assistida."
        steps={quickSteps}
        currentStep={currentTutorialStep}
      />

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr),minmax(340px,0.85fr)]">
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

            <div
              className={`rounded-2xl border p-4 text-sm ${
                messageTone === 'danger'
                  ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
                  : messageTone === 'success'
                    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                    : 'border-border bg-white/[0.02] text-muted'
              }`}
            >
              {message}
            </div>
          </Card>

          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Suites disponiveis</p>
                <h2 className="font-display text-xl font-bold text-foreground">Execucao Cypress por modulo</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {suiteSource ? <Badge tone="info">{suiteSource === 'manifest' ? 'Manifesto' : 'Scan'}</Badge> : null}
                {checkedSuites.length ? <Badge tone="warning">{checkedSuites.length} marcada(s)</Badge> : null}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Base URL</span>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://cliente.exemplo.com" />
              </label>

              <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                <p className="font-semibold text-foreground">Execucao atual</p>
                <p className="mt-2">
                  {suitesToRun.length
                    ? `${suitesToRun.length} suite(s) preparada(s) para rodar.`
                    : 'Marque suites por modulo ou selecione uma suite para ver os detalhes.'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {groupedSuites.length ? (
                groupedSuites.map((group) => {
                  const moduleCheckedCount = group.suites.filter((suite) => checkedSuiteIds.includes(suite.id)).length
                  const allChecked = moduleCheckedCount === group.suites.length && group.suites.length > 0

                  return (
                    <div key={group.moduleLabel} className="rounded-3xl border border-border bg-black/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Modulo</p>
                          <h3 className="font-display text-lg font-bold text-foreground">{group.moduleLabel}</h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{group.suites.length} suite(s)</Badge>
                          <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => toggleModuleSuites(group.suites)}>
                            {allChecked ? <Square className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                            {allChecked ? 'Desmarcar modulo' : 'Marcar modulo'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.suites.map((suite) => {
                          const isChecked = checkedSuiteIds.includes(suite.id)
                          const isActive = selectedSuiteId === suite.id

                          return (
                            <div
                              key={suite.id}
                              className={`rounded-2xl border p-4 transition ${
                                isActive
                                  ? 'border-accent/50 bg-accent/10'
                                  : 'border-border bg-white/[0.02] hover:border-accent/30'
                              }`}
                            >
                              <div className="flex flex-wrap items-start gap-3">
                                <label className="mt-1 inline-flex cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSuite(suite.id)}
                                    className="h-4 w-4 rounded border-border bg-black/20 accent-[hsl(var(--accent))]"
                                  />
                                  <span className="sr-only">Selecionar {suite.name}</span>
                                </label>

                                <button
                                  type="button"
                                  onClick={() => setSelectedSuiteId(suite.id)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="font-semibold text-foreground">{suite.name}</p>
                                  <p className="mt-1 break-all text-sm text-muted">{suite.spec}</p>
                                  <p className="mt-2 text-xs text-muted">{getSuiteSubpathLabel(suite.spec)}</p>
                                </button>
                              </div>

                              {suite.tags.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {suite.tags.map((tag) => (
                                    <Badge key={tag} tone="neutral">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                  Busque as suites primeiro para agrupar por modulo.
                </div>
              )}
            </div>

            {selectedSuite ? (
              <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                <p className="font-semibold text-foreground">{selectedSuite.name}</p>
                <p className="mt-1">{selectedSuite.spec}</p>
                {selectedSuite.description ? <p className="mt-2">{selectedSuite.description}</p> : null}
                {selectedSuite.requiredParams.length ? (
                  <p className="mt-2 text-xs text-muted">Parametros exigidos: {selectedSuite.requiredParams.join(', ')}</p>
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
                    <Input value={extraEnv[param] || ''} onChange={(event) => updateExtraEnv(param, event.target.value)} placeholder="Valor usado pelas suites marcadas" />
                  </label>
                ))}
              </div>
            ) : null}

            {executionIssues.length ? (
              <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
                <p className="font-semibold text-foreground">Antes de executar</p>
                <ul className="mt-2 space-y-1">
                  {executionIssues.map((issue) => (
                    <li key={issue}>- {issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleRunSuites()} disabled={isRunning}>
                {isRunning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {checkedSuites.length > 1 ? 'Executar marcadas' : 'Executar suite'}
              </Button>
              {latestFailedResult ? (
                <Button type="button" variant="secondary" onClick={handleOpenInAutomationBuilder}>
                  Abrir primeira falha no Automation Builder
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Retorno do Cypress</p>
                <h2 className="font-display text-xl font-bold text-foreground">Log da execucao</h2>
              </div>
              {batchRunResult ? (
                <Badge tone={batchRunResult.ok ? 'success' : 'danger'}>
                  {batchRunResult.passedSuites}/{batchRunResult.totalSuites} em {formatDuration(batchRunResult.durationMs)}
                </Badge>
              ) : runResult ? (
                <Badge tone={runResult.ok ? 'success' : 'danger'}>
                  {runResult.status} em {formatDuration(runResult.durationMs)}
                </Badge>
              ) : null}
            </div>

            {batchRunResult ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                  <p className="font-semibold text-foreground">Resumo da bateria</p>
                  <p className="mt-2">
                    {batchRunResult.passedSuites} passaram e {batchRunResult.failedSuites} falharam.
                  </p>
                </div>
                <pre className="max-h-[420px] max-w-full overflow-auto whitespace-pre rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
                  {buildBatchLog(batchRunResult)}
                </pre>
              </div>
            ) : runResult ? (
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
              Se existir um arquivo qa-orbit.suites.json na raiz do workspace, o QA Runner usa ele para nomear suites, agrupar por modulo e pedir parametros extras.
            </p>
            <pre className="max-w-full overflow-x-auto whitespace-pre rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
{`{
  "projectKey": "meu-projeto",
  "projectName": "Meu projeto",
  "suites": [
    {
      "id": "login-admin",
      "name": "Login admin",
      "spec": "cypress/e2e/painel-admin/login/login-admin.cy.js",
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
