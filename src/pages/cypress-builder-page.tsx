import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Code2,
  FileUp,
  FolderTree,
  LifeBuoy,
  PlaySquare,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { QuickTutorial } from '@/components/ui/quick-tutorial'
import { SectionHeader } from '@/components/ui/section-header'
import { consumeQaRunnerFailureHandoff } from '@/services/automation-handoff'
import {
  CYPRESS_BUILDER_EXAMPLE_BLUEPRINT,
  generateAutomationRunFailureContext,
  generateCypressFailureContext,
  listAutomationRunItems,
  listAutomationRuns,
  previewCypressBuilder,
  scaffoldAutomationWorkspace,
  runAutomationBattery,
  runAutomationSpec,
} from '@/services/cypress-builder-api'
import type {
  AutomationExecutionResult,
  AutomationFramework,
  AutomationLanguage,
  AutomationPattern,
  AutomationRunHistory,
  AutomationRunHistoryItem,
  AutomationTestType,
  AutomationWorkspaceStructureResponse,
  CypressBuilderFailureContextResponse,
  CypressBuilderPreviewResponse,
  CypressBuilderSpecMode,
} from '@/types/cypress-builder'

function slugify(value: string, fallback: string) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

function buildDefaultNames(source: unknown) {
  const candidate = source as {
    name?: string
    flowName?: string
  }
  const slug = slugify(candidate?.name || candidate?.flowName || 'qa-orbit-blueprint', 'qa-orbit-blueprint')

  return {
    suiteName: slug.replace(/-/g, ' '),
    fixtureFileName: `${slug}.json`,
    specFileName: `${slug}.cy.js`,
  }
}

const quickSteps = [
  {
    title: 'Carregue o blueprint',
    description: 'Importe o JSON exportado pelo Smart Recorder ou cole o conteudo no campo abaixo.',
  },
  {
    title: 'Gere o preview',
    description: 'Escolha Cypress, Playwright ou Selenium e clique em Gerar codigo.',
  },
  {
    title: 'Copie os arquivos',
    description: 'Copie a spec gerada para o caminho sugerido no workspace de automacao.',
  },
  {
    title: 'Execute a bateria',
    description: 'Informe a pasta do workspace, spec e parametros, depois execute pelo QA Orbit.',
  },
]

function selectClassName() {
  return 'h-10 w-full rounded-2xl border border-border bg-black/20 px-3 text-sm font-semibold text-foreground outline-none focus:border-accent/40'
}

function parseEnvText(value: string) {
  const env: Record<string, string> = {}

  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    env[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim()
  }

  return env
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0ms'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusTone(status: string) {
  if (status === 'passed') return 'success'
  if (status === 'failed' || status === 'error') return 'danger'
  if (status === 'partial') return 'warning'
  return 'neutral'
}

export function CypressBuilderPage() {
  const [rawBlueprint, setRawBlueprint] = useState('')
  const [testType, setTestType] = useState<AutomationTestType>('web-e2e')
  const [framework, setFramework] = useState<AutomationFramework>('cypress')
  const [language, setLanguage] = useState<AutomationLanguage>('javascript')
  const [pattern, setPattern] = useState<AutomationPattern>('simple')
  const [baseUrl, setBaseUrl] = useState('')
  const [suiteName, setSuiteName] = useState('login admin')
  const [fixtureFileName, setFixtureFileName] = useState('login-admin.json')
  const [specFileName, setSpecFileName] = useState('login-admin.cy.js')
  const [specMode, setSpecMode] = useState<CypressBuilderSpecMode>('runner_based')
  const [preview, setPreview] = useState<CypressBuilderPreviewResponse | null>(null)
  const [failureContext, setFailureContext] = useState<CypressBuilderFailureContextResponse | null>(null)
  const [message, setMessage] = useState('Cole um blueprint JSON valido ou importe um arquivo para gerar codigo no Automation Builder.')
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingFailureContext, setIsGeneratingFailureContext] = useState(false)
  const [copyState, setCopyState] = useState<'fixture' | 'spec' | 'context' | ''>('')
  const [failureSpecPath, setFailureSpecPath] = useState('')
  const [failureBaseUrl, setFailureBaseUrl] = useState('')
  const [failureExitCode, setFailureExitCode] = useState('1')
  const [failureDurationMs, setFailureDurationMs] = useState('12345')
  const [failureStdout, setFailureStdout] = useState('')
  const [failureStderr, setFailureStderr] = useState('')
  const [showFailureHelp, setShowFailureHelp] = useState(false)
  const [workingDir, setWorkingDir] = useState('')
  const [runSpecPath, setRunSpecPath] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [envText, setEnvText] = useState('password=minhaSenha')
  const [runResult, setRunResult] = useState<AutomationExecutionResult | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState('')
  const [automationProjectName, setAutomationProjectName] = useState('sheila')
  const [automationModuleName, setAutomationModuleName] = useState('painel-admin')
  const [automationSubmoduleName, setAutomationSubmoduleName] = useState('agendamento')
  const [workspaceStructure, setWorkspaceStructure] = useState<AutomationWorkspaceStructureResponse | null>(null)
  const [isScaffoldingWorkspace, setIsScaffoldingWorkspace] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [historyRuns, setHistoryRuns] = useState<AutomationRunHistory[]>([])
  const [selectedRun, setSelectedRun] = useState<AutomationRunHistory | null>(null)
  const [selectedRunItems, setSelectedRunItems] = useState<AutomationRunHistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const parsedBlueprint = useMemo(() => {
    if (!rawBlueprint.trim()) return null

    try {
      return JSON.parse(rawBlueprint)
    } catch {
      return null
    }
  }, [rawBlueprint])

  const summary = useMemo(() => {
    if (!preview?.blueprint) return null

    return {
      name: preview.blueprint.name || 'Blueprint sem nome',
      project: preview.blueprint.project?.name || 'Projeto nao informado',
      stepsCount: Array.isArray(preview.blueprint.steps) ? preview.blueprint.steps.length : 0,
      environment: preview.blueprint.environment || 'Nao informado',
    }
  }, [preview])

  const currentStepIndex = useMemo(() => {
    if (runResult) return 3
    if (workspaceStructure) return 2
    if (preview) return 1
    return 0
  }, [preview, runResult, workspaceStructure])

  const primaryHint = preview
    ? workspaceStructure
      ? 'Workspace estruturado. Agora abra a pasta na IDE, instale o framework e execute a suite.'
      : 'Codigo pronto. Agora estruture o workspace ou copie os arquivos gerados e execute uma spec ou bateria.'
    : parsedBlueprint
      ? 'JSON reconhecido. Escolha o framework e clique em Gerar codigo.'
      : 'Comece importando o arquivo JSON exportado pelo Smart Recorder.'

  async function refreshHistory() {
    setIsLoadingHistory(true)
    setHistoryError('')

    try {
      const response = await listAutomationRuns(30)
      setHistoryRuns(response.runs)
    } catch (nextError) {
      setHistoryError(nextError instanceof Error ? nextError.message : 'Nao foi possivel carregar historico.')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    void refreshHistory()
  }, [])

  useEffect(() => {
    const handoff = consumeQaRunnerFailureHandoff()
    if (!handoff) return

    setFramework(handoff.framework)
    setSuiteName(handoff.suiteName || handoff.runResult.spec || 'Suite Cypress')
    setWorkingDir(handoff.workspacePath || '')
    setRunSpecPath(handoff.suiteSpec || handoff.runResult.spec || '')
    setFailureSpecPath(handoff.suiteSpec || handoff.runResult.spec || '')
    setFailureBaseUrl(handoff.baseUrl || '')
    setFailureExitCode(String(handoff.runResult.exitCode || 0))
    setFailureDurationMs(String(handoff.runResult.durationMs || 0))
    setFailureStdout(handoff.runResult.stdout || '')
    setFailureStderr([handoff.runResult.stderr, handoff.runResult.error].filter(Boolean).join('\n'))
    setShowFailureHelp(true)
    setMessage(
      'Falha recebida do QA Runner. Carregue ou valide o blueprint correspondente e depois gere o contexto de correcao.',
    )
  }, [])

  async function handleCopy(kind: 'fixture' | 'spec' | 'context', content: string) {
    if (!content) return

    await navigator.clipboard.writeText(content)
    setCopyState(kind)
    setTimeout(() => setCopyState(''), 1800)
  }

  function applyDefaultNames(source: unknown) {
    const defaults = buildDefaultNames(source)
    setSuiteName(defaults.suiteName)
    setFixtureFileName(defaults.fixtureFileName)
    setSpecFileName(defaults.specFileName)
  }

  function handleLoadExample() {
    const nextValue = JSON.stringify(CYPRESS_BUILDER_EXAMPLE_BLUEPRINT, null, 2)
    setRawBlueprint(nextValue)
    applyDefaultNames(CYPRESS_BUILDER_EXAMPLE_BLUEPRINT)
    setFramework('cypress')
    setLanguage('javascript')
    setPattern('simple')
    setBaseUrl(CYPRESS_BUILDER_EXAMPLE_BLUEPRINT.startUrl || '')
    setPreview(null)
    setFailureContext(null)
    setFailureSpecPath('cypress/e2e/qa-orbit/login-admin.cy.js')
    setFailureBaseUrl('https://hml.exemplo.com.br/login?redirect=/admin#topo')
    setFailureExitCode('1')
    setFailureDurationMs('18765')
    setFailureStdout(
      "CypressError: Timed out retrying after 10000ms: Expected to find element: `input[type='password']`, but never found it.",
    )
    setFailureStderr(
      "AssertionError: expected '<body>' to contain 'Admin'\npassword=123456 token=abc123",
    )
    setError('')
    setMessage('Exemplo carregado. Agora voce pode validar o blueprint e revisar os previews.')
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const content = await file.text()
    setRawBlueprint(content)

    try {
      const parsed = JSON.parse(content)
      applyDefaultNames(parsed)
      setBaseUrl(String(parsed.baseUrl || parsed.startUrl || ''))
      setMessage(`Arquivo ${file.name} importado. Revise o JSON e clique em validar blueprint.`)
      setError('')
    } catch {
      setError('O arquivo foi importado, mas o conteudo nao e um JSON valido.')
      setMessage('Corrija o JSON antes de gerar os previews.')
    } finally {
      setPreview(null)
      event.target.value = ''
    }
  }

  async function handleValidateBlueprint() {
    if (!rawBlueprint.trim()) {
      setError('Cole ou importe um blueprint JSON antes de validar.')
      setPreview(null)
      return
    }

    let blueprint: unknown
    try {
      blueprint = JSON.parse(rawBlueprint)
    } catch {
      setError('O conteudo informado nao e um JSON valido.')
      setPreview(null)
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      const response = await previewCypressBuilder({
        blueprint,
        options: {
          suiteName,
          fixtureFileName,
          specFileName,
          specMode,
          moduleName: automationModuleName,
          submoduleName: automationSubmoduleName,
          framework,
          type: testType,
          language,
          pattern,
          baseUrl,
          specName: specFileName,
        },
      })
      setPreview(response)
      setFailureContext(null)
      setMessage(
        response.warnings.length
          ? `Codigo gerado com ${response.warnings.length} aviso(s). Revise antes de executar.`
          : `Codigo ${framework} gerado com sucesso.`,
      )
      setFailureSpecPath(response.suggestedPaths.specPath)
      setRunSpecPath(response.suggestedPaths.specPath)
    } catch (nextError) {
      setPreview(null)
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel validar o blueprint.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleGenerateFailureContext() {
    if (!parsedBlueprint) {
      setError('Carregue um blueprint JSON valido antes de gerar o contexto de correcao.')
      return
    }

    setIsGeneratingFailureContext(true)
    setError('')

    try {
      const response = await generateCypressFailureContext({
        runResult: {
          suiteName,
          framework,
          command: customCommand || runResult?.command || '',
          specPath: failureSpecPath,
          workspacePath: '',
          baseUrl: failureBaseUrl,
          exitCode: Number(failureExitCode || 0),
          durationMs: Number(failureDurationMs || 0),
          stdout: failureStdout,
          stderr: failureStderr,
        },
        blueprint: parsedBlueprint,
      })
      setFailureContext(response)
      setMessage('Contexto de correcao gerado. Agora voce pode copiar e colar no Assistente QA Orbit.')
    } catch (nextError) {
      setFailureContext(null)
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel gerar o contexto de correcao.')
    } finally {
      setIsGeneratingFailureContext(false)
    }
  }

  async function handleScaffoldWorkspace() {
    setIsScaffoldingWorkspace(true)
    setError('')

    try {
      const response = await scaffoldAutomationWorkspace({
        framework,
        workspaceRoot,
        projectName: automationProjectName,
        moduleName: automationModuleName,
        submoduleName: automationSubmoduleName,
        suiteName,
      })

      setWorkspaceStructure(response)
      setWorkingDir(response.workingDir)
      setRunSpecPath(response.suggestedPaths.specPath || runSpecPath)
      setMessage('Workspace estruturado com sucesso. Agora voce pode abrir a pasta na IDE e instalar o framework.')
    } catch (nextError) {
      setWorkspaceStructure(null)
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel estruturar o workspace de automacao.')
    } finally {
      setIsScaffoldingWorkspace(false)
    }
  }

  async function handleRunAutomation() {
    if (!workingDir.trim()) {
      setError('Informe a pasta do workspace para executar a automacao.')
      return
    }

    setIsRunning(true)
    setError('')
    setRunResult(null)

    try {
      const result = await runAutomationSpec({
        framework,
        workingDir,
        command: framework === 'selenium' ? customCommand || undefined : undefined,
        specPath: runSpecPath,
        baseUrl,
        env: parseEnvText(envText),
      })
      setRunResult(result)
      setFailureSpecPath(runSpecPath)
      setFailureBaseUrl(baseUrl)
      setFailureExitCode(String(result.exitCode))
      setFailureDurationMs(String(result.durationMs))
      setFailureStdout(result.stdout)
      setFailureStderr(result.stderr)
      setMessage(result.status === 'passed' ? 'Execucao concluida com sucesso.' : 'Execucao finalizada com falha. Abra a correcao assistida para gerar contexto.')
      await refreshHistory()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel executar automacao.')
    } finally {
      setIsRunning(false)
    }
  }

  async function handleRunBattery() {
    if (!workingDir.trim()) {
      setError('Informe a pasta do workspace para executar a bateria.')
      return
    }

    setIsRunning(true)
    setError('')

    try {
      const result = await runAutomationBattery({
        battery: {
          name: suiteName || 'Bateria QA Orbit',
          framework,
          workingDir,
          baseUrl,
          env: parseEnvText(envText),
          items: [
            {
              name: suiteName || runSpecPath || 'Spec QA Orbit',
              specPath: runSpecPath,
              command: framework === 'selenium' ? customCommand || undefined : undefined,
            },
          ],
        },
      })
      const firstResult = result.results[0] || null
      setRunResult(firstResult)
      setMessage(`Bateria ${result.status}: ${result.passed}/${result.total} item(ns) passaram.`)
      await refreshHistory()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel executar bateria.')
    } finally {
      setIsRunning(false)
    }
  }

  async function handleViewRun(run: AutomationRunHistory) {
    setHistoryError('')
    setSelectedRun(run)
    setSelectedRunItems([])

    try {
      const response = await listAutomationRunItems(run.id)
      setSelectedRun(response.run)
      setSelectedRunItems(response.items)
    } catch (nextError) {
      setHistoryError(nextError instanceof Error ? nextError.message : 'Nao foi possivel abrir detalhes da execucao.')
    }
  }

  async function handleFailureContextFromRun(runId: string) {
    setHistoryError('')

    try {
      const response = await generateAutomationRunFailureContext(runId)
      setFailureContext(response)
      setShowFailureHelp(true)
      setMessage('Contexto de correcao gerado a partir do historico salvo.')
    } catch (nextError) {
      setHistoryError(nextError instanceof Error ? nextError.message : 'Nao foi possivel gerar contexto do historico.')
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Automacao"
        title="Automation Builder"
        description="Monte, execute e corrija baterias automatizadas em Cypress, Playwright ou Selenium. A rota antiga do Cypress Builder continua funcionando."
        action={
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={handleLoadExample}>
              <Sparkles className="mr-2 h-4 w-4" />
              Carregar exemplo
            </Button>
            <Button type="button" onClick={() => void handleValidateBlueprint()} disabled={isGenerating}>
              <Code2 className="mr-2 h-4 w-4" />
              {isGenerating ? 'Gerando...' : 'Gerar codigo'}
            </Button>
          </div>
        }
      />

      <QuickTutorial
        title="O que fazer agora"
        description={primaryHint}
        steps={quickSteps}
        currentStep={currentStepIndex}
        totalStepsLabel={runResult ? 'Passo 4 de 4' : workspaceStructure ? 'Passo 3 de 4' : preview ? 'Passo 2 de 4' : 'Passo 1 de 4'}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr),minmax(360px,1.05fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Passo 1</p>
                <h2 className="font-display text-xl font-bold text-foreground">Carregue o blueprint JSON</h2>
                <p className="mt-1 text-sm text-muted">Use o arquivo baixado no Smart Recorder. Se ainda estiver testando, carregue o exemplo.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleImportFile(event)} />
                <Button type="button" variant="secondary" className="h-10 px-3" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Importar JSON
                </Button>
              </div>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Cole o JSON aqui</span>
              <textarea
                value={rawBlueprint}
                onChange={(event) => setRawBlueprint(event.target.value)}
                placeholder='Cole aqui o JSON exportado pelo Smart Recorder, por exemplo: {"name":"login admin","steps":[...]}'
                className="min-h-[340px] w-full rounded-3xl border border-border bg-black/20 px-4 py-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
              />
            </label>

            <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={parsedBlueprint ? 'success' : 'neutral'}>
                  {parsedBlueprint ? 'JSON valido localmente' : 'Aguardando JSON valido'}
                </Badge>
                {summary ? <Badge tone="info">{summary.stepsCount} step(s)</Badge> : null}
                {summary?.environment ? <Badge tone="neutral">Ambiente: {summary.environment}</Badge> : null}
              </div>

              {summary ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Fluxo</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{summary.name}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Projeto</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{summary.project}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Status</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {preview ? 'Preview sincronizado com backend' : 'Blueprint ainda nao validado no backend'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Depois que o JSON for reconhecido, clique em Validar blueprint. O QA Orbit vai avisar se faltar algo importante.
                </p>
              )}
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="text-sm text-muted">Passo 2</p>
              <h2 className="font-display text-xl font-bold text-foreground">Escolha framework e saida</h2>
              <p className="mt-1 text-sm text-muted">
                Web E2E esta ativo agora. API, Performance e Security ficam preparados para a proxima etapa.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Tipo de teste</span>
                <select value={testType} onChange={(event) => setTestType(event.target.value as AutomationTestType)} className={selectClassName()}>
                  <option value="web-e2e">Web E2E</option>
                  <option value="api" disabled>API - em breve</option>
                  <option value="performance" disabled>Performance - em breve</option>
                  <option value="security" disabled>Security - em breve</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Framework</span>
                <select
                  value={framework}
                  onChange={(event) => {
                    const nextFramework = event.target.value as AutomationFramework
                    setFramework(nextFramework)
                    setLanguage(nextFramework === 'playwright' ? 'typescript' : 'javascript')
                    setSpecFileName(nextFramework === 'cypress' ? 'login-admin.cy.js' : nextFramework === 'playwright' ? 'login-admin.spec.ts' : 'login-admin.test.js')
                  }}
                  className={selectClassName()}
                >
                  <option value="cypress">Cypress</option>
                  <option value="playwright">Playwright</option>
                  <option value="selenium">Selenium</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Linguagem</span>
                <select value={language} onChange={(event) => setLanguage(event.target.value as AutomationLanguage)} className={selectClassName()}>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="java" disabled={framework !== 'selenium'}>Java - preparado</option>
                  <option value="python" disabled>Python - em breve</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Padrao</span>
                <select value={pattern} onChange={(event) => setPattern(event.target.value as AutomationPattern)} className={selectClassName()}>
                  <option value="simple">Simples</option>
                  <option value="pageObject" disabled>Page Object - em breve</option>
                  <option value="gherkin" disabled>Gherkin - em breve</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Nome da suite</span>
                <Input value={suiteName} onChange={(event) => setSuiteName(event.target.value)} placeholder="login admin" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Nome do fixture</span>
                <Input value={fixtureFileName} onChange={(event) => setFixtureFileName(event.target.value)} placeholder="login-admin.json" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Nome da spec</span>
                <Input value={specFileName} onChange={(event) => setSpecFileName(event.target.value)} placeholder="login-admin.cy.js" />
              </label>
              <label className="space-y-2 md:col-span-3">
                <span className="text-sm font-semibold text-foreground">Base URL</span>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://hml.exemplo.com.br" />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => setSpecMode('runner_based')}
                className="rounded-3xl border border-accent/35 bg-accent/10 p-4 text-left shadow-glow"
              >
                <p className="text-sm font-semibold text-foreground">Runner generico</p>
                <p className="mt-2 text-sm text-muted">
                  No Cypress, preserva o helper runQaOrbitBlueprint. Em Playwright/Selenium, gera spec simples inicial.
                </p>
              </button>

              <div className="rounded-3xl border border-border bg-white/[0.02] p-4 opacity-70">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Spec expandida</p>
                  <Badge tone="warning">Roadmap</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Fase futura para gerar o codigo Cypress completo, sem depender do runner generico.
                </p>
              </div>
            </div>

            <Button type="button" onClick={() => void handleValidateBlueprint()} disabled={isGenerating || !rawBlueprint.trim()}>
              <Code2 className="mr-2 h-4 w-4" />
              {isGenerating ? 'Gerando codigo...' : 'Gerar codigo'}
            </Button>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="text-sm text-muted">Passo 3</p>
              <h2 className="font-display text-xl font-bold text-foreground">Estruturar workspace de automacao</h2>
              <p className="mt-1 text-sm text-muted">
                Organize a arvore do projeto pela interface do QA Orbit. O sistema cria a base do workspace e devolve os comandos prontos para abrir a pasta na IDE.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">Raiz do workspace</span>
                <Input value={workspaceRoot} onChange={(event) => setWorkspaceRoot(event.target.value)} placeholder="Deixe vazio para usar .\\automation-workspaces dentro do QA Orbit" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Projeto</span>
                <Input value={automationProjectName} onChange={(event) => setAutomationProjectName(event.target.value)} placeholder="sheila" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Modulo</span>
                <Input value={automationModuleName} onChange={(event) => setAutomationModuleName(event.target.value)} placeholder="painel-admin" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">Submodulo</span>
                <Input value={automationSubmoduleName} onChange={(event) => setAutomationSubmoduleName(event.target.value)} placeholder="agendamento" />
              </label>
            </div>

            <Button type="button" variant="secondary" onClick={() => void handleScaffoldWorkspace()} disabled={isScaffoldingWorkspace}>
              <FolderTree className="mr-2 h-4 w-4" />
              {isScaffoldingWorkspace ? 'Estruturando...' : 'Criar estrutura do workspace'}
            </Button>

            {workspaceStructure ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                  <p className="font-semibold text-foreground">Workspace criado</p>
                  <p className="mt-2 break-all">{workspaceStructure.workingDir}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Spec sugerida</p>
                      <p className="mt-2 break-all text-foreground">{workspaceStructure.suggestedPaths.specPath}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Fixture sugerido</p>
                      <p className="mt-2 break-all text-foreground">{workspaceStructure.suggestedPaths.fixturePath || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: 'Abrir no VS Code', command: workspaceStructure.commands.openInVscode },
                    { label: 'Abrir no Cursor', command: workspaceStructure.commands.openInCursor },
                    { label: 'Entrar na pasta', command: workspaceStructure.commands.enterDir },
                    { label: 'Instalar base Node', command: workspaceStructure.commands.npmInstall },
                    { label: 'Instalar framework', command: workspaceStructure.commands.frameworkInstall },
                    { label: 'Abrir framework', command: workspaceStructure.commands.openFramework },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => void handleCopy('context', item.command)}>
                          <ClipboardCopy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-border bg-black/30 p-3 text-xs leading-6 text-foreground">
                        {item.command}
                      </pre>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                  <p className="font-semibold text-foreground">Arquivos base criados</p>
                  <ul className="mt-3 space-y-2">
                    {workspaceStructure.createdFiles.map((filePath) => (
                      <li key={filePath} className="break-all">{filePath}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="text-sm text-muted">Passo 4</p>
              <h2 className="font-display text-xl font-bold text-foreground">Executar spec ou bateria</h2>
              <p className="mt-1 text-sm text-muted">
                Informe a pasta segura do workspace. Para workspaces externos, configure QA_ORBIT_AUTOMATION_WORKSPACE_ROOT no backend.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Workspace</span>
                <Input value={workingDir} onChange={(event) => setWorkingDir(event.target.value)} placeholder="C:\\projetos\\qarunner-cypress" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Spec path</span>
                <Input value={runSpecPath} onChange={(event) => setRunSpecPath(event.target.value)} placeholder={preview?.suggestedPaths.specPath || 'cypress/e2e/qa-orbit/login-admin.cy.js'} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">Env por linha</span>
                <textarea
                  value={envText}
                  onChange={(event) => setEnvText(event.target.value)}
                  placeholder={'password=minhaSenha\nusuario=admin'}
                  className="min-h-[88px] w-full rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                />
              </label>
              {framework === 'selenium' ? (
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-foreground">Comando Selenium customizado opcional</span>
                  <Input value={customCommand} onChange={(event) => setCustomCommand(event.target.value)} placeholder="npm test" />
                </label>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleRunAutomation()} disabled={isRunning}>
                <PlaySquare className="mr-2 h-4 w-4" />
                {isRunning ? 'Executando...' : 'Executar spec'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleRunBattery()} disabled={isRunning}>
                <PlaySquare className="mr-2 h-4 w-4" />
                Executar bateria
              </Button>
            </div>

            {runResult ? (
              <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={runResult.status === 'passed' ? 'success' : runResult.status === 'failed' ? 'danger' : 'warning'}>
                    {runResult.status}
                  </Badge>
                  <Badge tone="neutral">{runResult.framework}</Badge>
                  <Badge tone="neutral">exit {runResult.exitCode}</Badge>
                  <Badge tone="neutral">{runResult.durationMs}ms</Badge>
                </div>
                <p className="mt-3 font-semibold text-foreground">Comando</p>
                <p className="mt-1 break-all">{runResult.command}</p>
                {runResult.mainError ? (
                  <>
                    <p className="mt-3 font-semibold text-foreground">Erro principal</p>
                    <p className="mt-1">{runResult.mainError}</p>
                  </>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-start gap-3">
              {error ? <AlertTriangle className="mt-0.5 h-5 w-5 text-lime-100" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" />}
              <div>
                <p className="text-sm font-semibold text-foreground">{error ? 'Revisao necessaria' : 'Resumo da validacao'}</p>
                <p className="mt-1 text-sm text-muted">{error || message}</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted">Historico</p>
                <h2 className="font-display text-xl font-bold text-foreground">Historico de Execucoes</h2>
                <p className="mt-1 text-sm text-muted">
                  Execucoes individuais e baterias ficam salvas para comparar falhas e reutilizar contexto.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void refreshHistory()} disabled={isLoadingHistory}>
                {isLoadingHistory ? 'Atualizando...' : 'Atualizar historico'}
              </Button>
            </div>

            {historyError ? (
              <div className="rounded-2xl border border-lime-200/20 bg-lime-200/10 p-4 text-sm text-lime-100">
                {historyError}
              </div>
            ) : null}

            <div className="space-y-3">
              {historyRuns.length ? (
                historyRuns.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-border bg-black/20 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                          <Badge tone="neutral">{run.type}</Badge>
                          <Badge tone="neutral">{run.framework}</Badge>
                        </div>
                        <p className="mt-3 truncate text-sm font-semibold text-foreground">{run.name}</p>
                        <p className="mt-1 text-xs text-muted">{formatDateTime(run.createdAt)} - {formatDuration(run.durationMs)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">Total {run.total}</Badge>
                        <Badge tone="success">Passou {run.passed}</Badge>
                        <Badge tone={run.failed ? 'danger' : 'neutral'}>Falhou {run.failed}</Badge>
                        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => void handleViewRun(run)}>
                          Ver detalhes
                        </Button>
                        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => void handleFailureContextFromRun(run.id)}>
                          Gerar correcao
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                  Nenhuma execucao salva ainda. Rode uma spec ou bateria para alimentar o historico.
                </div>
              )}
            </div>

            {selectedRun ? (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedRun.name}</p>
                    <p className="mt-1 text-xs text-muted">Detalhes da execucao salva</p>
                  </div>
                  <Badge tone={statusTone(selectedRun.status)}>{selectedRun.status}</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedRunItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                        <Badge tone="neutral">exit {item.exitCode}</Badge>
                        <Badge tone="neutral">{formatDuration(item.durationMs)}</Badge>
                      </div>
                      <p className="mt-3 font-semibold text-foreground">{item.specName || item.specPath}</p>
                      <p className="mt-1 break-all">{item.specPath}</p>
                      {item.mainError ? (
                        <p className="mt-3 text-lime-100">{item.mainError}</p>
                      ) : null}
                      {item.artifacts.length ? (
                        <p className="mt-3 text-xs">{item.artifacts.length} artifact(s) registrado(s)</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm text-muted">Opcional</p>
                  <h2 className="font-display text-xl font-bold text-foreground">Falhou ao executar?</h2>
                  <p className="mt-1 text-sm text-muted">Use esta parte so depois de rodar a suite no QA Runner e receber erro.</p>
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => setShowFailureHelp((current) => !current)}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                {showFailureHelp ? 'Ocultar correcao' : 'Abrir correcao assistida'}
              </Button>
            </div>
          </Card>

          {showFailureHelp ? (
          <Card className="space-y-5">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-accent" />
              <div>
                <p className="text-sm text-muted">Correcao Assistida</p>
                <h2 className="font-display text-xl font-bold text-foreground">Cole o erro da automacao</h2>
                <p className="mt-1 text-sm text-muted">Copie stdout e stderr da execucao. O QA Orbit mascara dados sensiveis antes de gerar o contexto.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Spec</span>
                <Input value={failureSpecPath} onChange={(event) => setFailureSpecPath(event.target.value)} placeholder={runSpecPath || 'cypress/e2e/qa-orbit/login-admin.cy.js'} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Base URL</span>
                <Input value={failureBaseUrl} onChange={(event) => setFailureBaseUrl(event.target.value)} placeholder="https://hml.exemplo.com.br/login" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Exit code</span>
                <Input value={failureExitCode} onChange={(event) => setFailureExitCode(event.target.value)} placeholder="1" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Duracao em ms</span>
                <Input value={failureDurationMs} onChange={(event) => setFailureDurationMs(event.target.value)} placeholder="12345" />
              </label>
            </div>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">stdout</span>
                <textarea
                  value={failureStdout}
                  onChange={(event) => setFailureStdout(event.target.value)}
                  placeholder="Cole aqui o stdout da execucao"
                  className="min-h-[140px] w-full rounded-3xl border border-border bg-black/20 px-4 py-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">stderr</span>
                <textarea
                  value={failureStderr}
                  onChange={(event) => setFailureStderr(event.target.value)}
                  placeholder="Cole aqui o stderr da execucao"
                  className="min-h-[140px] w-full rounded-3xl border border-border bg-black/20 px-4 py-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                />
              </label>
            </div>

            <Button type="button" onClick={() => void handleGenerateFailureContext()} disabled={isGeneratingFailureContext}>
              <LifeBuoy className="mr-2 h-4 w-4" />
              {isGeneratingFailureContext ? 'Gerando contexto...' : 'Gerar contexto de correcao'}
            </Button>
          </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Antes de copiar</p>
                <h2 className="font-display text-xl font-bold text-foreground">Avisos do blueprint</h2>
              </div>
              <Badge tone={preview?.warnings.length ? 'warning' : 'success'}>
                {preview?.warnings.length ? `${preview.warnings.length} aviso(s)` : 'Sem avisos'}
              </Badge>
            </div>

            <div className="space-y-3">
              {preview?.warnings.length ? (
                preview.warnings.map((warning, index) => {
                  const tone =
                    warning.code.includes('weak') || warning.code.includes('unsupported') || warning.code.includes('sensitive')
                      ? 'danger'
                      : 'warning'

                  return (
                    <div key={`${warning.code}-${warning.stepOrder ?? 'global'}-${index}`} className="rounded-2xl border border-border bg-black/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone}>{warning.code}</Badge>
                        {warning.stepOrder ? <Badge tone="neutral">Passo {warning.stepOrder}</Badge> : <Badge tone="neutral">Blueprint</Badge>}
                      </div>
                      <p className="mt-3 text-sm text-muted">{warning.message}</p>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                  Os warnings aparecem aqui depois da validacao do backend. Esta area destaca seletores fracos, valores sensiveis, actions nao suportadas e lacunas do blueprint.
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Passo 3</p>
                <h2 className="font-display text-xl font-bold text-foreground">Copie o fixture JSON</h2>
                <p className="mt-1 text-sm text-muted">Salve este conteudo no arquivo indicado em Proximos passos.</p>
              </div>
              <Button type="button" variant="secondary" className="h-10 px-3" onClick={() => void handleCopy('fixture', preview?.fixtureJson || '')} disabled={!preview?.fixtureJson}>
                <ClipboardCopy className="mr-2 h-4 w-4" />
                {copyState === 'fixture' ? 'Fixture copiado' : 'Copiar fixture'}
              </Button>
            </div>

            <pre className="max-h-[360px] overflow-auto rounded-3xl border border-border bg-black/30 p-4 text-xs leading-6 text-foreground">
              {preview?.fixtureJson || '{\n  "name": "login admin"\n}'}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Passo 3</p>
                <h2 className="font-display text-xl font-bold text-foreground">Copie a spec gerada</h2>
                <p className="mt-1 text-sm text-muted">Esta spec executa os passos do blueprint no framework escolhido.</p>
              </div>
              <Button type="button" variant="secondary" className="h-10 px-3" onClick={() => void handleCopy('spec', preview?.specCode || '')} disabled={!preview?.specCode}>
                <ClipboardCopy className="mr-2 h-4 w-4" />
                {copyState === 'spec' ? 'Spec copiada' : 'Copiar spec'}
              </Button>
            </div>

            <pre className="max-h-[360px] overflow-auto rounded-3xl border border-border bg-black/30 p-4 text-xs leading-6 text-foreground">
              {preview?.specCode ||
                `import blueprint from '../../fixtures/qa-orbit/login-admin.json'\nimport { runQaOrbitBlueprint } from '../../support/qa-orbit/run-blueprint'\n\ndescribe('QA Orbit - Login admin', () => {\n  it('executa o fluxo exportado pelo QA Orbit', () => {\n    runQaOrbitBlueprint(blueprint)\n  })\n})`}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-accent" />
              <div>
                <p className="text-sm text-muted">Passo 4</p>
                <h2 className="font-display text-xl font-bold text-foreground">Onde colocar e como rodar</h2>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted">
              {framework === 'cypress' ? (
                <p>1. Salve o fixture em <span className="font-semibold text-foreground">{preview?.suggestedPaths.fixturePath || 'cypress/fixtures/qa-orbit/<nome>.json'}</span>.</p>
              ) : null}
              <p>{framework === 'cypress' ? '2' : '1'}. Salve a spec em <span className="font-semibold text-foreground">{preview?.suggestedPaths.specPath || 'tests/qa-orbit/<nome>.spec.ts'}</span>.</p>
              {framework === 'cypress' ? (
                <p>3. Confirme que o helper <span className="font-semibold text-foreground">runQaOrbitBlueprint</span> existe em <span className="font-semibold text-foreground">cypress/support/qa-orbit/run-blueprint</span>.</p>
              ) : null}
              <p>{framework === 'cypress' ? '4' : '2'}. Execute a spec ou bateria pelo Automation Builder, ou use a aba QA Runner para o fluxo Cypress antigo.</p>
            </div>

            <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
              <div className="flex items-start gap-3">
                <PlaySquare className="mt-0.5 h-4 w-4 text-accent" />
                <p>
                  Se o blueprint usa <span className="font-semibold text-foreground">{'{{password}}'}</span>, passe a senha no campo Env. O QA Orbit preserva placeholders e sanitiza logs antes da correcao assistida.
                </p>
              </div>
            </div>
          </Card>

          {showFailureHelp ? (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Correcao Assistida por IA</p>
                <h2 className="font-display text-xl font-bold text-foreground">Contexto para o Assistente QA Orbit</h2>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-10 px-3"
                onClick={() => void handleCopy('context', failureContext?.contextText || '')}
                disabled={!failureContext?.contextText}
              >
                <ClipboardCopy className="mr-2 h-4 w-4" />
                {copyState === 'context' ? 'Contexto copiado' : 'Copiar contexto para Assistente QA Orbit'}
              </Button>
            </div>

            {failureContext ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={failureContext.detectedFailure.confidence === 'high' ? 'success' : failureContext.detectedFailure.confidence === 'medium' ? 'warning' : 'neutral'}>
                    Confianca: {failureContext.detectedFailure.confidence}
                  </Badge>
                  {failureContext.detectedFailure.stepOrder ? <Badge tone="info">Passo provavel {failureContext.detectedFailure.stepOrder}</Badge> : null}
                  {failureContext.detectedFailure.action ? <Badge tone="neutral">Action: {failureContext.detectedFailure.action}</Badge> : null}
                </div>

                <div className="rounded-2xl border border-border bg-black/20 p-4 text-sm text-muted">
                  <p className="font-semibold text-foreground">Erro principal</p>
                  <p className="mt-2">{failureContext.detectedFailure.message || 'Nao identificado com seguranca.'}</p>
                  <p className="mt-3 font-semibold text-foreground">Selector detectado</p>
                  <p className="mt-2 break-all">{failureContext.detectedFailure.selector || 'Nao identificado com seguranca.'}</p>
                </div>

                {failureContext.warnings.length ? (
                  <div className="space-y-3">
                    {failureContext.warnings.map((warning, index) => (
                      <div key={`${warning.code}-${warning.stepOrder ?? 'global'}-${index}`} className="rounded-2xl border border-border bg-black/20 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">{warning.code}</Badge>
                          {warning.stepOrder ? <Badge tone="neutral">Passo {warning.stepOrder}</Badge> : null}
                        </div>
                        <p className="mt-3 text-sm text-muted">{warning.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <pre className="max-h-[420px] overflow-auto rounded-3xl border border-border bg-black/30 p-4 text-xs leading-6 text-foreground">
                  {failureContext.contextText}
                </pre>
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                Cole stdout e stderr, depois clique em gerar contexto de correcao. O QA Orbit vai sanitizar os logs, mascarar dados sensiveis e montar um texto pronto para colar no Assistente QA Orbit.
              </div>
            )}
          </Card>
          ) : null}
        </div>
      </section>
    </div>
  )
}
