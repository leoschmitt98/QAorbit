import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProjectScope } from '@/hooks/use-project-scope'
import { agents } from '@/data/mock-data'
import { ComplementaryScenariosForm } from '@/components/shared/complementary-scenarios-form'
import { EvidenceBuilder } from '@/components/shared/evidence-builder'
import { FlowReuseClassifier } from '@/components/shared/flow-reuse-classifier'
import { HistoricalTestRecorder } from '@/components/shared/historical-test-recorder'
import { ProblemStructuringForm } from '@/components/shared/problem-structuring-form'
import { PromptViewer } from '@/components/shared/prompt-viewer'
import { RelatedHistoricalTests } from '@/components/shared/related-historical-tests'
import { RetestExecutionForm } from '@/components/shared/retest-execution-form'
import { TicketContextForm } from '@/components/shared/ticket-context-form'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { listCatalogModules, useCatalogAreasQuery, useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import { downloadEvidenceDocx } from '@/services/evidence-export-api'
import { listSavedFlows, loadFlowProgress, saveFlowProgress, updateFlowLifecycleStatus } from '@/services/flow-progress-api'
import { useFunctionalDocumentsQuery } from '@/services/functional-docs-api'
import { listRelatedHistoricalTests, saveHistoricalTest } from '@/services/historical-tests-api'
import { importPsrDocument } from '@/services/psr-import'
import { importTicketClipboardContent } from '@/services/ticket-clipboard-import'
import { useQuery } from '@tanstack/react-query'
import type {
  ComplementaryScenario,
  FlowReuseClassification,
  HistoricalTestRecommendation,
  HistoricalTestMetadataDraft,
  ProblemStructuring,
  PromptAnalysisMode,
  SavedFlowSummary,
  RetestExecutionDraft,
  TicketContext,
} from '@/types/domain'

const steps = [
  'Contexto do chamado',
  'Estruturacao do problema',
  'Execucao do reteste',
  'Cenarios complementares',
  'Consolidacao da evidencia',
  'Classificacao para reuso',
]

const emptyTicket: TicketContext = {
  ticketId: '',
  title: '',
  customerProblemDescription: '',
  projectId: '',
  productType: 'Portal',
  portalArea: 'Aluno',
  moduleId: '',
  environment: '',
  version: '',
  origin: 'Suporte',
  baseReference: '',
  accessUrl: '',
  username: '',
  password: '',
  companyCode: '',
  unitCode: '',
  branchName: '',
  developerChangelog: '',
  documentoBaseName: '',
  supportAttachments: [],
}

const emptyProblem: ProblemStructuring = {
  problemDescription: '',
  initialAnalysis: '',
  expectedBehavior: '',
  reportedBehavior: '',
  relatedDocumentation: '',
  testData: '',
}

const emptyRetest: RetestExecutionDraft = {
  preconditions: '',
  gifName: '',
  gifPreviewUrl: '',
  frames: [],
  steps: [],
  obtainedBehavior: '',
  status: 'Parcial',
  uploads: [],
}

const emptyClassification: FlowReuseClassification = {
  reusable: false,
  mainModuleId: '',
  impactedModuleIds: [],
  criticality: 'Media',
  automationCandidate: false,
  automationName: '',
}

const emptyHistoryMetadata: HistoricalTestMetadataDraft = {
  flowScenario: '',
  bugId: '',
  criticality: 'Media',
  tags: [],
  hasAutomation: false,
  automationFramework: 'Cypress',
  specPath: '',
  impactedModuleIds: [],
}

function extractArtifactPaths(changelog: string) {
  const normalized = String(changelog || '')
  const artifactPattern =
    /(?:[A-Za-z]:)?[A-Za-z0-9_.\-\\/]+(?:\/|\\)[A-Za-z0-9_.\-\\/]+\.(?:ts|tsx|js|jsx|php|cs|java|sql|json|yml|yaml|vue|spec\.ts|cy\.ts|cy\.js)/gi

  const matches = normalized.match(artifactPattern) ?? []
  return Array.from(new Set(matches.map((item) => item.trim()))).slice(0, 12)
}

export function NewAnalysisPage() {
  const navigate = useNavigate()
  const { selectedProjectId } = useProjectScope()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentStep, setCurrentStep] = useState(0)
  const [ticket, setTicket] = useState<TicketContext>(emptyTicket)
  const [problem, setProblem] = useState<ProblemStructuring>(emptyProblem)
  const [retest, setRetest] = useState<RetestExecutionDraft>(emptyRetest)
  const [scenarios, setScenarios] = useState<ComplementaryScenario[]>([])
  const [classification, setClassification] = useState<FlowReuseClassification>(emptyClassification)
  const [historyMetadata, setHistoryMetadata] = useState<HistoricalTestMetadataDraft>(emptyHistoryMetadata)
  const [aiResponse, setAiResponse] = useState('')
  const [historyRecordIds, setHistoryRecordIds] = useState<string[]>([])
  const [selectedFunctionalDocumentIds, setSelectedFunctionalDocumentIds] = useState<string[]>([])
  const [promptMode, setPromptMode] = useState<PromptAnalysisMode>('diagnostico_funcional')
  const [activeAgentId, setActiveAgentId] = useState('')
  const [savedFlows, setSavedFlows] = useState<SavedFlowSummary[]>([])
  const [progressMessage, setProgressMessage] = useState('Nenhum salvamento executado nesta sessao.')
  const [isSupportRailCollapsed, setIsSupportRailCollapsed] = useState(false)
  const [isSavingProgress, setIsSavingProgress] = useState(false)
  const [isLoadingProgress, setIsLoadingProgress] = useState(false)
  const [isExportingWord, setIsExportingWord] = useState(false)
  const [isUpdatingLifecycle, setIsUpdatingLifecycle] = useState(false)
  const [isOpeningBug, setIsOpeningBug] = useState(false)
  const [isSavingHistory, setIsSavingHistory] = useState(false)
  const [documentImportMessage, setDocumentImportMessage] = useState('Upload de PSR pode preencher automaticamente o cabecalho do chamado.')
  const [clipboardImportMessage, setClipboardImportMessage] = useState(
    'Cole o texto do card ou work item para o sistema tentar reconhecer os campos automaticamente.',
  )
  const [historyMessage, setHistoryMessage] = useState('Quando o fluxo estiver consistente, salve-o no histórico para reutilizar esse cenário no futuro.')
  const [exportMessage, setExportMessage] = useState('Preencha o chamado, capture os quadros e gere o documento quando estiver pronto.')

  const projectsQuery = useCatalogProjectsQuery()
  const areasQuery = useCatalogAreasQuery()
  const modulesQuery = useCatalogModulesQuery(ticket.projectId)
  const functionalDocumentsQuery = useFunctionalDocumentsQuery({
    projectId: ticket.projectId,
    moduleId: ticket.moduleId,
  })

  const catalogProjects = projectsQuery.data ?? []
  const catalogModules = modulesQuery.data ?? []
  const catalogAreas = areasQuery.data ?? []
  const relatedFunctionalDocs = functionalDocumentsQuery.data ?? []
  const selectedFunctionalDocs = relatedFunctionalDocs.filter((document) =>
    selectedFunctionalDocumentIds.includes(document.id),
  )

  const combinedModules = catalogModules.map((item) => ({
    id: item.id,
    projectId: item.projetoId,
    name: item.nome,
    summary: '',
    documents: 0,
    rules: 0,
    bugs: 0,
    executions: 0,
    lastChange: new Date().toISOString(),
  }))

  const selectedProject =
    catalogProjects.find((item) => item.id === ticket.projectId)?.nome ?? '-'
  const selectedModule =
    catalogModules.find((item) => item.id === ticket.moduleId)?.nome ?? (ticket.moduleId || '-')
  const selectedArea =
    catalogAreas.find((item) => item.id === ticket.portalArea)?.nome ?? ticket.portalArea
  const extractedArtifacts = useMemo(() => extractArtifactPaths(ticket.developerChangelog), [ticket.developerChangelog])
  const relatedHistoryEnabled = Boolean(
    ticket.projectId.trim() &&
      ticket.moduleId.trim() &&
      ticket.portalArea.trim() &&
      (historyMetadata.flowScenario.trim() || problem.problemDescription.trim()),
  )

  const relatedHistoryQuery = useQuery({
    queryKey: [
      'related-historical-tests',
      ticket.projectId,
      ticket.moduleId,
      ticket.portalArea,
      historyMetadata.flowScenario,
      problem.problemDescription,
      historyMetadata.tags.join('|'),
      classification.impactedModuleIds.join('|'),
    ],
    queryFn: () =>
      listRelatedHistoricalTests({
        projeto: ticket.projectId,
        moduloPrincipal: ticket.moduleId,
        portalArea: ticket.portalArea,
        fluxoCenario: historyMetadata.flowScenario || ticket.title,
        resumoProblema: problem.problemDescription,
        tags: historyMetadata.tags,
        modulosImpactados: classification.impactedModuleIds,
      }),
    enabled: relatedHistoryEnabled,
  })

  const ticketContextError =
    projectsQuery.error || areasQuery.error || modulesQuery.error
      ? 'Nao foi possivel sincronizar alguns catalogos agora.'
      : null

  useEffect(() => {
    void refreshSavedFlows()
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId || ticket.ticketId.trim() || ticket.projectId.trim()) return
    setTicket((current) => ({
      ...current,
      projectId: selectedProjectId,
    }))
  }, [selectedProjectId, ticket.ticketId, ticket.projectId])

  useEffect(() => {
    setSelectedFunctionalDocumentIds((current) =>
      current.filter((documentId) => relatedFunctionalDocs.some((document) => document.id === documentId)),
    )
  }, [relatedFunctionalDocs])

  useEffect(() => {
    if (relatedFunctionalDocs.length === 0) {
      setSelectedFunctionalDocumentIds([])
      return
    }

    setSelectedFunctionalDocumentIds((current) => {
      if (current.length > 0) return current

      const preferredDocs = relatedFunctionalDocs
        .filter((document) =>
          ['Regra de negocio', 'Caso de uso', 'Criterio de aceite'].includes(document.type),
        )
        .slice(0, 3)
        .map((document) => document.id)

      return preferredDocs.length > 0 ? preferredDocs : relatedFunctionalDocs.slice(0, 2).map((document) => document.id)
    })
  }, [ticket.projectId, ticket.moduleId, relatedFunctionalDocs])

  useEffect(() => {
    const requestedTicketId = searchParams.get('ticketId')?.trim()
    const requestedPromptMode = searchParams.get('promptMode')?.trim() as PromptAnalysisMode | ''
    const requestedAgentId = searchParams.get('agent')?.trim() || ''
    const requestedStep = Number(searchParams.get('step') || '')

    if (requestedPromptMode) {
      setPromptMode(requestedPromptMode)
    }

    if (requestedAgentId) {
      setActiveAgentId(requestedAgentId)
    }

    if (Number.isFinite(requestedStep) && requestedStep >= 0 && requestedStep < steps.length && !requestedTicketId) {
      setCurrentStep(requestedStep)
    }

    if (!requestedTicketId) {
      return
    }

    void (async () => {
      await handleLoadProgress(requestedTicketId)
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.delete('ticketId')
        next.delete('agent')
        next.delete('promptMode')
        next.delete('step')
        return next
      })
    })()
  }, [searchParams])

  async function refreshSavedFlows() {
    try {
      const flows = await listSavedFlows()
      setSavedFlows(flows.filter((flow) => (selectedProjectId ? flow.projectId === selectedProjectId : true)))
    } catch {
      setSavedFlows([])
    }
  }

  async function handleSaveProgress() {
    if (!ticket.ticketId.trim()) {
      setProgressMessage('Informe o ID do chamado antes de salvar o progresso.')
      return
    }

    setIsSavingProgress(true)
    try {
      const response = await saveFlowProgress(ticket.ticketId, {
        currentStep,
        ticket,
        problem,
        retest,
        scenarios,
        classification,
        aiResponse,
        historyRecordIds,
        selectedFunctionalDocumentIds,
      })
      setProgressMessage(`Progresso salvo para ${ticket.ticketId} em ${new Date(response.updatedAt).toLocaleString('pt-BR')}.`)
      await refreshSavedFlows()
    } catch (error) {
      setProgressMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o progresso agora.')
    } finally {
      setIsSavingProgress(false)
    }
  }

  async function handleLoadProgress(ticketId: string) {
    const resolvedTicketId = ticketId.trim() || savedFlows[0]?.ticketId || ''

    if (!resolvedTicketId) {
      setProgressMessage('Nenhum progresso salvo foi encontrado para carregar.')
      return
    }

    setIsLoadingProgress(true)
    try {
      const draft = await loadFlowProgress(resolvedTicketId)
      setCurrentStep(draft.currentStep ?? 0)
      setTicket(draft.ticket)
      setProblem(draft.problem)
      setRetest(draft.retest)
      setScenarios(draft.scenarios)
      setClassification(draft.classification)
      setAiResponse(draft.aiResponse)
      setHistoryRecordIds(draft.historyRecordIds ?? [])
      setSelectedFunctionalDocumentIds(draft.selectedFunctionalDocumentIds ?? [])
      setProgressMessage(`Chamado ${draft.ticket.ticketId} recarregado. Continue de onde parou.`)
      await refreshSavedFlows()
    } catch (error) {
      setProgressMessage(error instanceof Error ? error.message : 'Nao foi possivel localizar o progresso salvo.')
    } finally {
      setIsLoadingProgress(false)
    }
  }

  async function handleExportWord() {
    if (!ticket.ticketId.trim()) {
      setExportMessage('Informe o ID do chamado antes de gerar o Word.')
      return
    }

    setIsExportingWord(true)
    try {
      await saveFlowProgress(ticket.ticketId, {
        currentStep,
        ticket,
        problem,
        retest,
        scenarios,
        classification,
        aiResponse,
        historyRecordIds,
        selectedFunctionalDocumentIds,
      })
      const exportResult = await downloadEvidenceDocx(ticket.ticketId)
      setExportMessage(
        `Documento Word gerado para ${ticket.ticketId}. Download iniciado em ${exportResult.fileName} e uma copia foi salva no storage do chamado.`,
      )
      await refreshSavedFlows()
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Nao foi possivel gerar o documento Word.')
    } finally {
      setIsExportingWord(false)
    }
  }

  async function handleLifecycleChange(nextLifecycleStatus: 'Em andamento' | 'Finalizado') {
    if (!ticket.ticketId.trim()) {
      setProgressMessage('Informe o ID do chamado e salve o progresso antes de alterar o status operacional.')
      return
    }

    setIsUpdatingLifecycle(true)
    try {
      await saveFlowProgress(ticket.ticketId, {
        currentStep,
        ticket,
        problem,
        retest,
        scenarios,
        classification,
        aiResponse,
        historyRecordIds,
        selectedFunctionalDocumentIds,
        lifecycleStatus: nextLifecycleStatus,
      })
      await updateFlowLifecycleStatus(ticket.ticketId, nextLifecycleStatus)
      setProgressMessage(
        nextLifecycleStatus === 'Finalizado'
          ? `Chamado ${ticket.ticketId} marcado como finalizado.`
          : `Chamado ${ticket.ticketId} reaberto para continuidade.`,
      )
      await refreshSavedFlows()
    } catch (error) {
      setProgressMessage(
        error instanceof Error ? error.message : 'Nao foi possivel atualizar o status operacional do chamado.',
      )
    } finally {
      setIsUpdatingLifecycle(false)
    }
  }

  async function handleOpenLinkedBug() {
    if (!ticket.ticketId.trim()) {
      setProgressMessage('Informe o ID do chamado antes de vincular um bug.')
      return
    }

    setIsOpeningBug(true)
    try {
      await saveFlowProgress(ticket.ticketId, {
        currentStep,
        ticket,
        problem,
        retest,
        scenarios,
        classification,
        aiResponse,
        historyRecordIds,
        selectedFunctionalDocumentIds,
      })
      setProgressMessage(`Chamado ${ticket.ticketId} salvo e enviado para o workspace de bug.`)
      await refreshSavedFlows()
      navigate(`/bugs/new?ticketId=${encodeURIComponent(ticket.ticketId)}`)
    } catch (error) {
      setProgressMessage(
        error instanceof Error ? error.message : 'Nao foi possivel abrir o bug vinculado agora.',
      )
    } finally {
      setIsOpeningBug(false)
    }
  }

  async function handleSaveHistory(finalizeAfter: boolean) {
    if (!ticket.ticketId.trim()) {
      setHistoryMessage('Informe o ID do chamado antes de salvar um registro historico.')
      return
    }

    if (!historyMetadata.flowScenario.trim()) {
      setHistoryMessage('Informe o fluxo/cenario testado para registrar esse histórico.')
      return
    }

    setIsSavingHistory(true)
    try {
      await saveFlowProgress(ticket.ticketId, {
        currentStep,
        ticket,
        problem,
        retest,
        scenarios,
        classification,
        aiResponse,
        historyRecordIds,
        selectedFunctionalDocumentIds,
        lifecycleStatus: finalizeAfter ? 'Finalizado' : undefined,
      })

      const record = await saveHistoricalTest({
        ticketId: ticket.ticketId,
        bugId: historyMetadata.bugId || undefined,
        projectId: ticket.projectId,
        modulePrincipalId: classification.mainModuleId || ticket.moduleId,
        portalArea: ticket.portalArea,
        fluxoCenario: historyMetadata.flowScenario,
        resumoProblema: problem.problemDescription || ticket.customerProblemDescription,
        comportamentoEsperado: problem.expectedBehavior,
        comportamentoObtido: retest.obtainedBehavior || problem.reportedBehavior,
        resultadoFinal: retest.status,
        criticidade: historyMetadata.criticality,
        modulosImpactados: historyMetadata.impactedModuleIds,
        tags: historyMetadata.tags,
        temAutomacao: historyMetadata.hasAutomation,
        frameworkAutomacao: historyMetadata.hasAutomation ? historyMetadata.automationFramework : '',
        caminhoSpec: historyMetadata.hasAutomation ? historyMetadata.specPath : '',
        chamadoTitulo: ticket.title,
      })

      const nextHistoryRecordIds = historyRecordIds.includes(record.id)
        ? historyRecordIds
        : [...historyRecordIds, record.id]
      setHistoryRecordIds(nextHistoryRecordIds)

      await saveFlowProgress(ticket.ticketId, {
        currentStep,
        ticket,
        problem,
        retest,
        scenarios,
        classification,
        aiResponse,
        historyRecordIds: nextHistoryRecordIds,
        selectedFunctionalDocumentIds,
        lifecycleStatus: finalizeAfter ? 'Finalizado' : undefined,
      })

      if (finalizeAfter) {
        await updateFlowLifecycleStatus(ticket.ticketId, 'Finalizado')
      }

      setHistoryMessage(
        finalizeAfter
          ? `Historico ${record.id} salvo e chamado ${ticket.ticketId} finalizado com sucesso.`
          : `Historico ${record.id} salvo para consulta futura por modulo e cenario.`,
      )
      setProgressMessage(
        finalizeAfter
          ? `Chamado ${ticket.ticketId} finalizado e registrado no historico.`
          : `Chamado ${ticket.ticketId} continua em andamento e agora possui registro no historico.`,
      )
      await refreshSavedFlows()
    } catch (error) {
      setHistoryMessage(
        error instanceof Error ? error.message : 'Nao foi possivel salvar o registro no historico agora.',
      )
    } finally {
      setIsSavingHistory(false)
    }
  }

  async function handleImportBaseDocument(file: File) {
    try {
      const imported = await importPsrDocument(file)

      setTicket((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(imported.ticketUpdates).filter(([, value]) => String(value || '').trim()),
        ),
        documentoBaseName: file.name,
      }))

      setProblem((current) => ({
        ...current,
        problemDescription: imported.problemUpdates.problemDescription || current.problemDescription,
        expectedBehavior: imported.problemUpdates.expectedBehavior || current.expectedBehavior,
        initialAnalysis: imported.problemUpdates.initialAnalysis || current.initialAnalysis,
        testData: imported.problemUpdates.testData || current.testData,
      }))

      setDocumentImportMessage(
        `PSR ${file.name} importado. Os principais campos operacionais do chamado foram preenchidos automaticamente.`,
      )
    } catch (error) {
      setDocumentImportMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel importar automaticamente o PSR agora.',
      )
    }
  }

  async function handleImportClipboardText(rawText: string) {
    try {
      const previewImport = await importTicketClipboardContent({
        text: rawText,
        projects: catalogProjects,
        modules: [],
        areas: catalogAreas,
      })

      const resolvedProjectId = previewImport.ticketUpdates.projectId || ticket.projectId
      const modulesForImport = resolvedProjectId ? await listCatalogModules(resolvedProjectId) : []
      const imported = await importTicketClipboardContent({
        text: rawText,
        projects: catalogProjects,
        modules: modulesForImport,
        areas: catalogAreas,
      })

      setTicket((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(imported.ticketUpdates).filter(([, value]) => String(value || '').trim()),
        ),
      }))

      setProblem((current) => ({
        ...current,
        problemDescription: imported.problemUpdates.problemDescription || current.problemDescription,
        expectedBehavior: imported.problemUpdates.expectedBehavior || current.expectedBehavior,
        reportedBehavior: imported.problemUpdates.reportedBehavior || current.reportedBehavior,
        initialAnalysis: imported.problemUpdates.initialAnalysis || current.initialAnalysis,
      }))

      setClipboardImportMessage(
        imported.matchedHints.length > 0
          ? `Importacao concluida. Campos reconhecidos: ${imported.matchedHints.join(', ')}.`
          : 'O conteudo foi importado, mas poucos campos foram reconhecidos automaticamente. Revise os dados preenchidos.',
      )
    } catch (error) {
      setClipboardImportMessage(
        error instanceof Error ? error.message : 'Nao foi possivel importar automaticamente o conteudo colado.',
      )
    }
  }

  function sanitizeMultiline(value?: string | null) {
    return String(value || '').trim() || 'Nao informado.'
  }

  function buildFunctionalDocsSection() {
    if (selectedFunctionalDocs.length === 0) {
      return 'Nenhum documento funcional vinculado a este projeto/modulo.'
    }

    return selectedFunctionalDocs
      .slice(0, 5)
      .map(
        (document, index) =>
          `${index + 1}. ${document.title} | Tipo: ${document.type} | Versao: ${document.version || 'v1'} | Resumo: ${document.summary || 'Sem resumo'} | Arquivo: ${document.fileName || '-'} | Caminho: ${document.downloadUrl || '-'}`,
      )
      .join('\n')
  }

  function buildArtifactsSection() {
    if (extractedArtifacts.length === 0) {
      return 'Nenhum artefato tecnico foi identificado automaticamente no changelog do dev.'
    }

    return extractedArtifacts.map((artifact, index) => `${index + 1}. ${artifact}`).join('\n')
  }

  function buildRelatedHistorySection(records: HistoricalTestRecommendation[]) {
    if (records.length === 0) {
      return 'Nenhum historico relacionado encontrado ate o momento.'
    }

    return records
      .slice(0, 3)
      .map(
        (record, index) =>
          `${index + 1}. Chamado ${record.ticketId} | Tipo: ${record.type === 'regressao_sugerida' ? 'regressao sugerida' : 'historico relacionado'} | Score: ${record.impactScore} | Fluxo: ${record.fluxoCenario || 'Nao informado'} | Resultado final: ${record.resultadoFinal} | Motivos: ${record.matchReasons.join(', ') || 'Sem motivos detalhados'}`,
      )
      .join('\n')
  }

  function buildFramesSection() {
    if (retest.frames.length === 0) {
      return 'Nenhum quadro visual foi capturado ainda.'
    }

    return retest.frames
      .map((frame, index) => `${index + 1}. ${frame.name} | ${frame.description?.trim() || 'Sem descricao adicional'}`)
      .join('\n')
  }

  function buildStepsSection() {
    if (retest.steps.length === 0) {
      return 'Nenhum passo visual foi consolidado ainda.'
    }

    return retest.steps
      .map((step, index) => {
        const frameSummary = step.frameIds
          .map((frameId) => retest.frames.find((frame) => frame.id === frameId))
          .filter(Boolean)
          .map((frame) => frame!.description?.trim() || frame!.name)
          .join(' | ')

        return `${index + 1}. Quadros associados: ${frameSummary || 'Sem quadro associado'} | Status visual do passo: ${step.status}`
      })
      .join('\n')
  }

  function buildComplementaryScenarioSection() {
    if (scenarios.length === 0) {
      return 'Nenhum cenario complementar registrado.'
    }

    return scenarios
      .map(
        (scenario, index) =>
          `${index + 1}. ${scenario.description} | Modulo: ${combinedModules.find((module) => module.id === scenario.moduleId)?.name || scenario.moduleId || 'Nao informado'} | Resultado esperado: ${scenario.expectedResult || 'Nao informado'} | Resultado obtido: ${scenario.obtainedResult || 'Nao informado'} | Status: ${scenario.status}`,
      )
      .join('\n')
  }

  function buildPromptByMode(mode: PromptAnalysisMode, relatedRecords: HistoricalTestRecommendation[]) {
    const contextBlock = [
      `Chamado: ${ticket.ticketId || 'Nao informado'}`,
      `Titulo: ${ticket.title || 'Nao informado'}`,
      `Projeto: ${selectedProject}`,
      `Modulo principal: ${selectedModule}`,
      `Portal/Area: ${selectedArea || 'Nao informado'}`,
      `Tipo de produto: ${ticket.productType}`,
      `Ambiente: ${ticket.environment || 'Nao informado'}`,
      `Versao/Hotfix: ${ticket.version || 'Nao informado'}`,
      `Origem do chamado: ${ticket.origin}`,
      `Documento base: ${ticket.documentoBaseName || 'Nao informado'}`,
    ].join('\n')

    const problemBlock = [
      `Descricao original do cliente: ${sanitizeMultiline(ticket.customerProblemDescription)}`,
      `Descricao estruturada do problema: ${sanitizeMultiline(problem.problemDescription)}`,
      `Analise inicial do QA/suporte: ${sanitizeMultiline(problem.initialAnalysis)}`,
      `Comportamento esperado: ${sanitizeMultiline(problem.expectedBehavior)}`,
      `Comportamento relatado/obtido: ${sanitizeMultiline(problem.reportedBehavior || retest.obtainedBehavior)}`,
      `Regra ou documentacao relacionada: ${sanitizeMultiline(problem.relatedDocumentation)}`,
      `Dados de teste: ${sanitizeMultiline(problem.testData)}`,
    ].join('\n')

    const technicalCorrectionBlock = [
      `Branch/Hotfix informado: ${sanitizeMultiline(ticket.branchName)}`,
      `Changelog tecnico do dev: ${sanitizeMultiline(ticket.developerChangelog)}`,
      `Artefatos citados no changelog:\n${buildArtifactsSection()}`,
    ].join('\n')

    const functionalBaseBlock = [
      `Documentos vinculados ao modulo atual:\n${buildFunctionalDocsSection()}`,
    ].join('\n')

    const qaExecutionBlock = [
      `Pre-condicoes: ${sanitizeMultiline(retest.preconditions)}`,
      `Resumo do reteste: ${sanitizeMultiline(retest.obtainedBehavior)}`,
      `Resultado final do reteste: ${retest.status}`,
      `Passos visuais consolidados:\n${buildStepsSection()}`,
      `Quadros capturados:\n${buildFramesSection()}`,
      `Cenarios complementares:\n${buildComplementaryScenarioSection()}`,
      `Modulos impactados declarados: ${classification.impactedModuleIds.join(', ') || 'Nenhum informado'}`,
      `Historicos relacionados mais relevantes:\n${buildRelatedHistorySection(relatedRecords)}`,
    ].join('\n\n')

    if (mode === 'diagnostico_repositorio') {
      return [
        'Voce vai atuar como engenheiro de software senior e QA tecnico dentro do repositorio do projeto impactado. Analise com foco em aderencia funcional, regra de negocio e risco de regressao.',
        '',
        '[CONTEXTO DO CHAMADO]',
        contextBlock,
        '',
        '[PROBLEMA E REGRA DE NEGOCIO]',
        problemBlock,
        '',
        '[BASE FUNCIONAL DO MODULO]',
        functionalBaseBlock,
        '',
        '[CONTEXTO TECNICO DA CORRECAO]',
        technicalCorrectionBlock,
        '',
        '[EXECUCAO DO QA]',
        qaExecutionBlock,
        '',
        '[OBJETIVO DA ANALISE]',
        '1. Localize no repositorio o fluxo e os arquivos mais provaveis do modulo informado.',
        '2. Avalie se a implementacao aparenta respeitar a regra de negocio e os casos de uso descritos.',
        '3. Aponte impactos provaveis em modulos vizinhos e regressos historicos relacionados.',
        '4. Identifique se faltam validacoes no codigo, tratamentos de estado ou cenarios cobertos apenas parcialmente.',
        '5. Diga se o fluxo e um bom candidato para teste automatizado com Cypress.',
        '',
        '[FORMATO OBRIGATORIO DA RESPOSTA]',
        'Responda em 5 blocos exatamente nesta ordem:',
        '1. Diagnostico tecnico principal',
        '2. Regra de negocio atendida ou violada',
        '3. Riscos e regressos provaveis com arquivos ou pontos do fluxo',
        '4. Cenarios adicionais recomendados para QA',
        '5. Viabilidade de automacao Cypress com sugestao de spec',
      ].join('\n')
    }

    if (mode === 'avaliacao_cypress') {
      return [
        'Voce vai atuar como especialista em QA e automacao E2E com Cypress. Avalie se este chamado gera um fluxo estavel, valioso e viavel para automacao.',
        '',
        '[CONTEXTO DO CHAMADO]',
        contextBlock,
        '',
        '[PROBLEMA E FLUXO VALIDADO]',
        problemBlock,
        '',
        '[BASE FUNCIONAL DO MODULO]',
        functionalBaseBlock,
        '',
        '[EVIDENCIAS E PASSOS VISUAIS]',
        qaExecutionBlock,
        '',
        '[OBJETIVO DA ANALISE]',
        '1. Dizer se vale automatizar este fluxo com Cypress agora.',
        '2. Justificar considerando estabilidade, repetibilidade, massa de dados e valor de regressao.',
        '3. Sugerir o melhor escopo: smoke, regressao, fluxo principal ou caso negativo.',
        '4. Propor nome do spec, estrutura inicial e asserts mais importantes.',
        '5. Apontar dependencias ou riscos para nao gerar teste fragil.',
        '',
        '[FORMATO OBRIGATORIO DA RESPOSTA]',
        'Responda em 5 blocos exatamente nesta ordem:',
        '1. Decisao sobre automacao',
        '2. Motivos para automatizar ou nao',
        '3. Escopo ideal do teste',
        '4. Sugestao de spec Cypress',
        '5. Riscos e preparacao necessaria',
      ].join('\n')
    }

    if (mode === 'testeplan_gherkin') {
      return [
        'Voce vai atuar como QA senior especialista em especificacao funcional e escrever um teste plan em Gherkin a partir do chamado, da regra de negocio e do reteste realizado.',
        '',
        '[CONTEXTO DO CHAMADO]',
        contextBlock,
        '',
        '[PROBLEMA E REGRA DE NEGOCIO]',
        problemBlock,
        '',
        '[BASE FUNCIONAL DO MODULO]',
        functionalBaseBlock,
        '',
        '[EXECUCAO DO QA]',
        qaExecutionBlock,
        '',
        '[OBJETIVO DA ANALISE]',
        '1. Transformar este fluxo em cenarios Given/When/Then claros e reutilizaveis.',
        '2. Separar cenario principal, variacoes negativas e verificacoes de regressao relevantes.',
        '3. Indicar pre-condicoes, massa de dados e criterios de aceite observaveis.',
        '4. Sinalizar lacunas no contexto que precisem ser esclarecidas antes de automatizar.',
        '',
        '[FORMATO OBRIGATORIO DA RESPOSTA]',
        'Responda em 5 blocos exatamente nesta ordem:',
        '1. Resumo funcional do fluxo',
        '2. Pre-condicoes e dados necessarios',
        '3. Cenario principal em Gherkin',
        '4. Cenarios negativos ou complementares em Gherkin',
        '5. Observacoes para reuso e automacao futura',
      ].join('\n')
    }

    return [
      'Voce vai atuar como QA senior fazendo um diagnostico funcional cirurgico da correcao, confrontando chamado, documentacao, regra de negocio e evidencias do reteste.',
      '',
      '[CONTEXTO DO CHAMADO]',
      contextBlock,
      '',
      '[PROBLEMA E EXPECTATIVAS]',
      problemBlock,
      '',
      '[BASE FUNCIONAL DO MODULO]',
      functionalBaseBlock,
      '',
      '[RESULTADO DO QA]',
      qaExecutionBlock,
      '',
      '[OBJETIVO DA ANALISE]',
      '1. Dizer se a correcao parece aderente ao chamado e a regra de negocio.',
      '2. Apontar incoerencias entre comportamento esperado, comportamento obtido e documentacao.',
      '3. Identificar cenarios complementares faltantes ou riscos de regressao.',
      '4. Destacar historicos relacionados que merecem atencao antes de seguir para master.',
      '',
      '[FORMATO OBRIGATORIO DA RESPOSTA]',
      'Responda em 5 blocos exatamente nesta ordem:',
      '1. Diagnostico funcional principal',
      '2. Regra de negocio atendida ou violada',
      '3. Riscos e regressos provaveis',
      '4. Cenarios adicionais recomendados',
      '5. Conclusao objetiva sobre liberar ou nao para seguir',
    ].join('\n')
  }

  const prompt = useMemo(
    () => buildPromptByMode(promptMode, relatedHistoryQuery.data ?? []),
    [classification, problem, promptMode, relatedHistoryQuery.data, retest, scenarios, selectedArea, selectedModule, selectedProject, ticket],
  )

  const promptNotes = useMemo(() => {
    const commonNotes = [
      'Reaproveita dados reais do chamado e da documentacao',
      'Separa contexto, regra, execucao e pedido final',
      'Obriga a IA a responder em blocos previsiveis',
    ]

    if (promptMode === 'diagnostico_repositorio') {
      return [...commonNotes, 'Direciona a investigacao para o codigo e impacto tecnico']
    }

    if (promptMode === 'avaliacao_cypress') {
      return [...commonNotes, 'Forca decisao objetiva sobre automacao e spec Cypress']
    }

    if (promptMode === 'testeplan_gherkin') {
      return [...commonNotes, 'Conduz a IA a devolver cenarios Given/When/Then reutilizaveis']
    }

    return [...commonNotes, 'Foca em aderencia funcional e riscos antes da liberacao']
  }, [promptMode])

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? null,
    [activeAgentId],
  )
  const currentSavedFlow = useMemo(
    () => savedFlows.find((flow) => flow.ticketId === ticket.ticketId.trim()) ?? null,
    [savedFlows, ticket.ticketId],
  )

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Nova analise"
        title="Fluxo operacional de validacao de chamados"
        description="Conduza o ticket do contexto inicial ate a evidencia final com rastreabilidade, cenarios complementares e classificacao para reuso."
      />

      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/[0.02] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Organizacao da tela</p>
            <p className="text-sm text-muted">
              Use o modo de foco para priorizar o preenchimento do chamado e abrir o painel lateral apenas quando precisar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GlowButton onClick={() => setIsSupportRailCollapsed((current) => !current)}>
              {isSupportRailCollapsed ? 'Mostrar painel lateral' : 'Focar formulario'}
            </GlowButton>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-6">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setCurrentStep(index)}
              className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                currentStep === index
                  ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow'
                  : 'border-border bg-white/[0.02] text-muted hover:border-accent/20'
              }`}
            >
              <span className="block text-xs uppercase tracking-[0.18em]">Etapa {index + 1}</span>
              <span className="mt-2 block font-semibold">{step}</span>
            </button>
          ))}
        </div>

        <div
          className={`grid gap-6 ${
            isSupportRailCollapsed
              ? 'grid-cols-1'
              : 'xl:grid-cols-[minmax(0,1.45fr),minmax(320px,0.55fr)] 2xl:grid-cols-[minmax(0,1.35fr),minmax(360px,0.65fr)]'
          }`}
        >
          <div className="space-y-6">
            {currentStep === 0 ? (
              <TicketContextForm
                value={ticket}
                projects={catalogProjects}
                modules={catalogModules}
                areas={catalogAreas}
                projectsLoading={projectsQuery.isLoading}
                modulesLoading={modulesQuery.isLoading}
                areasLoading={areasQuery.isLoading}
                errorMessage={ticketContextError}
                importMessage={documentImportMessage}
                importTextMessage={clipboardImportMessage}
                onImportDocument={(file) => void handleImportBaseDocument(file)}
                onImportText={(text) => void handleImportClipboardText(text)}
                onChange={setTicket}
              />
            ) : null}
            {currentStep === 1 ? <ProblemStructuringForm value={problem} onChange={setProblem} /> : null}
            {currentStep === 2 ? <RetestExecutionForm ticketId={ticket.ticketId} value={retest} onChange={setRetest} /> : null}
            {currentStep === 3 ? (
              <ComplementaryScenariosForm
                ticketId={ticket.ticketId}
                scenarios={scenarios}
                modules={combinedModules}
                impactedModuleIds={classification.impactedModuleIds}
                onScenariosChange={setScenarios}
                onImpactedModulesChange={(impactedModuleIds) =>
                  setClassification({ ...classification, impactedModuleIds })
                }
              />
            ) : null}
            {currentStep === 4 ? (
              <EvidenceBuilder
                title={ticket.title}
                ticket={ticket}
                problem={problem}
                retest={retest}
                scenarios={scenarios}
                modules={combinedModules}
                createdAt={new Date().toISOString()}
                exportMessage={exportMessage}
                isExporting={isExportingWord}
                onExport={() => void handleExportWord()}
              />
            ) : null}
            {currentStep === 5 ? (
              <div className="space-y-6">
                <FlowReuseClassifier
                  value={classification}
                  modules={combinedModules}
                  onChange={(nextValue) => {
                    setClassification(nextValue)
                    setHistoryMetadata((current) => ({
                      ...current,
                      criticality: nextValue.criticality,
                      impactedModuleIds: nextValue.impactedModuleIds,
                    }))
                  }}
                />
                <HistoricalTestRecorder
                  value={historyMetadata}
                  modules={combinedModules}
                  portalArea={ticket.portalArea}
                  mainModuleId={classification.mainModuleId || ticket.moduleId}
                  onChange={setHistoryMetadata}
                  onSave={(finalizeAfter) => void handleSaveHistory(finalizeAfter)}
                  isSaving={isSavingHistory}
                  message={historyMessage}
                />
              </div>
            ) : null}
          </div>

          {!isSupportRailCollapsed ? (
          <div className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <Card className="space-y-4">
              {activeAgent ? (
                <div className="rounded-2xl border border-accent/25 bg-accent/8 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Agente ativo</p>
                  <p className="mt-2 font-display text-lg font-bold text-foreground">{activeAgent.name}</p>
                  <p className="mt-2 text-sm text-muted">{activeAgent.description}</p>
                </div>
              ) : null}
              <div>
                <p className="text-sm text-muted">Rascunho do chamado</p>
                <h3 className="font-display text-xl font-bold text-foreground">Salvar e retomar progresso</h3>
              </div>
              <p className="text-sm text-muted">
                Salve o andamento atual do chamado para continuar depois sem perder contexto, quadros e passos ja montados.
              </p>
              <div className="flex flex-wrap gap-3">
                <GlowButton onClick={() => void handleSaveProgress()}>
                  {isSavingProgress ? 'Salvando...' : 'Salvar progresso'}
                </GlowButton>
                <GlowButton onClick={() => void handleLoadProgress(ticket.ticketId)}>
                  {isLoadingProgress
                    ? 'Carregando...'
                    : ticket.ticketId.trim()
                      ? 'Carregar este chamado'
                      : 'Carregar ultimo salvo'}
                </GlowButton>
                <GlowButton onClick={() => void handleLifecycleChange('Finalizado')} disabled={isUpdatingLifecycle || !ticket.ticketId.trim()}>
                  {isUpdatingLifecycle ? 'Atualizando...' : 'Finalizar chamado'}
                </GlowButton>
                <GlowButton onClick={() => void handleLifecycleChange('Em andamento')} disabled={isUpdatingLifecycle || !ticket.ticketId.trim()}>
                  Reabrir chamado
                </GlowButton>
                <GlowButton onClick={() => void handleOpenLinkedBug()} disabled={isOpeningBug || !ticket.ticketId.trim()}>
                  {isOpeningBug ? 'Abrindo bug...' : 'Vincular bug'}
                </GlowButton>
              </div>
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                {progressMessage}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Chamados com progresso salvo</p>
                <div className="space-y-2">
                  {savedFlows.length > 0 ? (
                    savedFlows.slice(0, 6).map((flow) => (
                      <button
                        key={flow.ticketId}
                        type="button"
                        onClick={() => void handleLoadProgress(flow.ticketId)}
                        className="flex w-full items-center justify-between rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-left text-sm transition hover:border-accent/20"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{flow.ticketId}</p>
                          <p className="text-muted">{flow.title}</p>
                        </div>
                        <div className="text-right text-xs text-muted">
                          <p>Status do chamado: {flow.lifecycleStatus}</p>
                          <p>Resultado do reteste: {flow.status}</p>
                          <p>{new Date(flow.updatedAt).toLocaleString('pt-BR')}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
                      Nenhum progresso salvo encontrado ainda.
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <div>
                <p className="text-sm text-muted">Painel do ticket</p>
                <h3 className="font-display text-xl font-bold text-foreground">Resumo operacional</h3>
              </div>
              <div className="space-y-3">
                {[
                  ['Ticket', ticket.ticketId],
                  ['Projeto', selectedProject],
                  ['Ambiente', ticket.environment],
                  ['Versao', ticket.version],
                  ['Modulo', selectedModule],
                  ['Produto', ticket.productType],
                  ['Portal / Area', ticket.portalArea],
                  ['Origem', ticket.origin],
                  ['Base', ticket.baseReference],
                  ['DLL / URL', ticket.accessUrl],
                  ['Usuario', ticket.username],
                  ['Empresa', ticket.companyCode],
                  ['Unidade', ticket.unitCode],
                  ['Branch', ticket.branchName],
                  ['Changelog do dev', ticket.developerChangelog],
                ].map(([label, value]) => {
                  const normalizedValue = String(value || '').trim() || '-'
                  const shouldStack =
                    normalizedValue.length > 80 ||
                    normalizedValue.includes('\n') ||
                    label === 'Changelog do dev' ||
                    label === 'Base'

                  return (
                    <div
                      key={label}
                      className={`rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm ${shouldStack ? 'space-y-2' : 'flex items-start justify-between gap-3'}`}
                    >
                      <span className="text-muted">{label}</span>
                      <span
                        className={`font-semibold text-foreground ${shouldStack ? 'block whitespace-pre-wrap break-words' : 'max-w-[65%] text-right whitespace-pre-wrap break-words'}`}
                      >
                        {normalizedValue}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="rounded-2xl border border-accent/15 bg-accent/8 p-4">
                <p className="text-sm font-semibold text-foreground">Status operacional do chamado</p>
                <div className="mt-3">
                  <StatusBadge value={currentSavedFlow?.lifecycleStatus ?? 'Em andamento'} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Este status muda quando voce usa os botoes `Finalizar chamado` ou `Reabrir chamado`.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-foreground">Resultado atual do reteste</p>
                <div className="mt-3">
                  <StatusBadge value={retest.status} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Este resultado continua mostrando a conclusao do reteste, como `Aprovado`, `Parcial` ou `Reprovado`.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-foreground">Leitura rapida dos status</p>
                <div className="mt-3 space-y-2 text-sm text-muted">
                  <p>
                    <span className="font-semibold text-foreground">Chamado finalizado</span> significa que o fluxo operacional foi encerrado.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Reteste parcial</span> significa que o resultado funcional ainda ficou inconclusivo ou incompleto.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-foreground">Bug vinculado ao chamado</p>
                <p className="mt-2 text-sm text-muted">
                  Use este chamado como pai do bug. O workspace de bug herdara automaticamente o contexto e permitira montar o passo a passo de reproducao e gerar o Word para dev.
                </p>
                <div className="mt-4">
                  <GlowButton onClick={() => void handleOpenLinkedBug()} disabled={isOpeningBug || !ticket.ticketId.trim()}>
                    {isOpeningBug ? 'Abrindo bug...' : 'Abrir bug deste chamado'}
                  </GlowButton>
                </div>
              </div>
            </Card>

            <RelatedHistoricalTests
              records={relatedHistoryQuery.data ?? []}
              isLoading={relatedHistoryQuery.isLoading}
              enabled={relatedHistoryEnabled}
            />

            <Card className="space-y-4">
              <div>
                <p className="text-sm text-muted">Base funcional e contexto tecnico</p>
                <h3 className="font-display text-xl font-bold text-foreground">Documentos do modulo e artefatos do changelog</h3>
                <p className="mt-2 text-sm text-muted">
                  Este bloco prepara a analise no Codex com os artefatos mencionados pelo dev e os documentos funcionais vinculados ao modulo atual.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Artefatos citados no changelog</p>
                {extractedArtifacts.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {extractedArtifacts.map((artifact) => (
                      <span
                        key={artifact}
                        className="rounded-full border border-border bg-black/20 px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {artifact}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Nenhum artefato foi reconhecido ainda. Se o changelog citar arquivos, componentes, controllers, services ou specs, eles aparecerão aqui.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Documentos funcionais do modulo</p>
                {ticket.projectId && ticket.moduleId ? (
                  functionalDocumentsQuery.isLoading ? (
                    <p className="mt-3 text-sm text-muted">Carregando base funcional do módulo...</p>
                  ) : relatedFunctionalDocs.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-black/20 p-3 text-sm">
                        <span className="text-muted">
                          <span className="font-semibold text-foreground">{selectedFunctionalDocs.length}</span> documento(s) entrarão no prompt
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedFunctionalDocumentIds(relatedFunctionalDocs.map((document) => document.id))}
                            className="rounded-xl border border-border px-3 py-1 font-semibold text-foreground transition hover:border-accent/25"
                          >
                            Selecionar todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedFunctionalDocumentIds([])}
                            className="rounded-xl border border-border px-3 py-1 font-semibold text-muted transition hover:border-accent/25 hover:text-foreground"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {relatedFunctionalDocs.slice(0, 5).map((document) => (
                        <div key={document.id} className="rounded-2xl border border-border bg-black/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedFunctionalDocumentIds.includes(document.id)}
                                onChange={(event) =>
                                  setSelectedFunctionalDocumentIds((current) =>
                                    event.target.checked
                                      ? Array.from(new Set([...current, document.id]))
                                      : current.filter((documentId) => documentId !== document.id),
                                  )
                                }
                                className="mt-1 h-4 w-4 rounded border-border bg-black/20 accent-[#a3ff12]"
                              />
                              <div>
                                <p className="font-semibold text-foreground">{document.title}</p>
                                <p className="mt-1 text-sm text-muted">
                                  {document.type} · {document.version || 'v1'}
                                </p>
                              </div>
                            </div>
                            {document.downloadUrl ? (
                              <a
                                href={document.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-accent"
                              >
                                Abrir
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-muted">{document.summary || 'Sem resumo informado.'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      Nenhum documento funcional foi vinculado a este módulo ainda.
                    </p>
                  )
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Selecione projeto e módulo para puxar os documentos relacionados e usar esse contexto no prompt.
                  </p>
                )}
              </div>
            </Card>

            {currentStep === 0 ? (
              <Card className="space-y-3">
                <div>
                  <p className="text-sm text-muted">Prompt final</p>
                  <h3 className="font-display text-xl font-bold text-foreground">Disponivel nas etapas finais</h3>
                </div>
                <p className="text-sm text-muted">
                  O prompt sera exibido com mais valor quando o contexto funcional, o reteste e os cenarios complementares estiverem preenchidos.
                </p>
              </Card>
            ) : (
              <PromptViewer
                prompt={prompt}
                response={aiResponse}
                onResponseChange={setAiResponse}
                onCopy={() => navigator.clipboard.writeText(prompt)}
                mode={promptMode}
                onModeChange={setPromptMode}
                promptNotes={promptNotes}
              />
            )}
          </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <GlowButton onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}>Anterior</GlowButton>
          <GlowButton onClick={() => setCurrentStep((step) => Math.min(step + 1, steps.length - 1))}>
            Proxima etapa
          </GlowButton>
        </div>
      </Card>
    </div>
  )
}

