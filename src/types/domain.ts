export interface Project {
  id: string
  name: string
  description: string
  status: 'Ativo' | 'Em homologacao' | 'Congelado'
  squad: string
  owner: string
  modulesCount: number
  documentsCount: number
  bugsCount: number
  lastUpdated: string
  coverage: number
}

export interface Module {
  id: string
  projectId: string
  name: string
  summary: string
  documents: number
  rules: number
  bugs: number
  executions: number
  lastChange: string
}

export interface DocumentItem {
  id: string
  title: string
  type: 'Caso de uso' | 'Regra de negocio' | 'Documento funcional' | 'Criterio de aceite' | 'Fluxo conhecido'
  projectId: string
  projectName?: string
  moduleId: string
  moduleName?: string
  version: string
  updatedAt: string
  summary: string
  tags: string[]
  author: string
  fileName?: string
  downloadUrl?: string
  mimeType?: string
  sizeBytes?: number
}

export interface BugItem {
  id: string
  title: string
  description: string
  projectId: string
  moduleId: string
  environment: string
  release: string
  priority: 'Baixa' | 'Media' | 'Alta' | 'Critica'
  severity: 'Leve' | 'Moderada' | 'Alta' | 'Bloqueante'
  status: 'Novo' | 'Em analise' | 'Em reteste' | 'Aguardando ajuste' | 'Concluido'
  relatedRule: string
  relatedDocument: string
  assignee: string
  openedAt: string
}

export type BugSeverity = 'Leve' | 'Moderada' | 'Alta' | 'Bloqueante'
export type BugPriority = 'Baixa' | 'Media' | 'Alta' | 'Critica'
export type BugStatus = 'Novo' | 'Em analise' | 'Pronto para dev' | 'Corrigido' | 'Concluido'

export interface BugTicketSnapshot {
  ticketId: string
  ticketTitle: string
  projectId: string
  projectName?: string
  moduleId: string
  moduleName?: string
  portalArea: string
  environment: string
  version: string
  origin: string
  baseReference: string
  accessUrl: string
  username: string
  password: string
  companyCode: string
  unitCode: string
  branchName: string
  developerChangelog: string
  customerProblemDescription: string
  initialAnalysis: string
  documentoBaseName: string
}

export interface BugReproductionStep {
  id: string
  order: number
  description: string
  observedResult?: string
}

export interface BugEvidenceDraft {
  gifName: string
  gifPreviewUrl: string
  frames: RetestFrame[]
}

export interface BugRecord {
  id: string
  ticketId: string
  title: string
  expectedBehavior: string
  obtainedBehavior: string
  severity: BugSeverity
  priority: BugPriority
  status: BugStatus
  createdAt: string
  updatedAt: string
  reproductionSteps: BugReproductionStep[]
  evidence: BugEvidenceDraft
  ticketSnapshot: BugTicketSnapshot
  createdByUserId?: string
  ownerName?: string
}

export interface ExecutionItem {
  id: string
  bugId: string
  tester: string
  status: 'Aprovado' | 'Reprovado' | 'Bloqueado' | 'Parcial'
  startedAt: string
  checklist: string[]
  steps: string[]
  expectedResult: string
  obtainedResult: string
  notes: string
}

export interface EvidenceItem {
  id: string
  name: string
  type: 'Print' | 'GIF' | 'Video' | 'Log'
  date: string
  projectId: string
  moduleId: string
  bugId: string
  size: string
}

export interface ActivityItem {
  id: string
  title: string
  description: string
  date: string
  type: 'document' | 'bug' | 'execution' | 'evidence'
}

export interface DashboardMetrics {
  totalProjects: number
  totalBugs: number
  testsInProgress: number
  testsCompleted: number
  recentEvidence: number
  recentDocuments: number
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  focus: string
  recommendedFor: string
  executor: string
  requiresLinkedTicket: boolean
  expectedOutput: string
  promptMode: PromptAnalysisMode
  suggestedStep: number
}

export interface AnalysisRecord {
  id: string
  projectId: string
  moduleId: string
  bugId: string
  title: string
  analysisType: 'Montar evidencia' | 'Validar fluxo' | 'Gerar regressao' | 'Criar caso de teste'
  agentId: string
  status: 'Rascunho' | 'Pronto para IA' | 'Respondido'
  createdAt: string
  prompt: string
  aiResponse: string
}

export type ProductType = 'Portal' | 'Sistema interno' | 'API'
export type TicketOrigin = 'Suporte' | 'Cliente' | 'Interno'
export type PortalArea = 'Aluno' | 'Professor' | 'Secretaria'
export type RetestStatus = 'Aprovado' | 'Reprovado' | 'Parcial' | 'Bloqueado'
export type ReuseCriticality = 'Baixa' | 'Media' | 'Alta'
export type StepValidationStatus = 'OK' | 'NOK' | 'Parcial'
export type FrameAnnotationType = 'circle' | 'arrow' | 'text' | 'click'
export type FlowLifecycleStatus = 'Em andamento' | 'Finalizado'
export type AutomationFramework = 'Cypress' | 'Playwright' | 'Outro'

export interface TicketContext {
  ticketId: string
  title: string
  customerProblemDescription: string
  projectId: string
  productType: ProductType
  portalArea: PortalArea
  moduleId: string
  environment: string
  version: string
  origin: TicketOrigin
  baseReference: string
  accessUrl: string
  username: string
  password: string
  companyCode: string
  unitCode: string
  branchName: string
  developerChangelog: string
  documentoBaseName: string
  supportAttachments: string[]
}

export interface ProblemStructuring {
  problemDescription: string
  initialAnalysis: string
  expectedBehavior: string
  reportedBehavior: string
  relatedDocumentation: string
  testData: string
}

export interface RetestStep {
  id: string
  status: StepValidationStatus
  frameIds: string[]
}

export interface FrameAnnotation {
  id: string
  type: FrameAnnotationType
  x: number
  y: number
  text?: string
}

export interface RetestFrame {
  id: string
  name: string
  imageUrl: string
  timestampLabel: string
  description?: string
  fileName?: string
  downloadUrl?: string
  persistedAt?: string
  annotations: FrameAnnotation[]
  editHistory: string[]
}

export interface RetestExecutionDraft {
  preconditions: string
  gifName: string
  gifPreviewUrl: string
  frames: RetestFrame[]
  steps: RetestStep[]
  obtainedBehavior: string
  status: RetestStatus
  uploads: string[]
}

export interface ComplementaryScenario {
  id: string
  description: string
  moduleId: string
  expectedResult: string
  obtainedResult: string
  status: RetestStatus
  gifName?: string
  gifPreviewUrl?: string
  frames?: RetestFrame[]
}

export interface FlowReuseClassification {
  reusable: boolean
  mainModuleId: string
  impactedModuleIds: string[]
  criticality: ReuseCriticality
  automationCandidate: boolean
  automationName: string
}

export interface QaFlowRecord {
  id: string
  title: string
  ticketContext: TicketContext
  problem: ProblemStructuring
  retest: RetestExecutionDraft
  complementaryScenarios: ComplementaryScenario[]
  classification: FlowReuseClassification
  createdAt: string
  finalConclusion: string
  generatedPrompt: string
  aiResponse: string
}

export interface QaFlowDraftPayload {
  currentStep: number
  ticket: TicketContext
  problem: ProblemStructuring
  retest: RetestExecutionDraft
  scenarios: ComplementaryScenario[]
  classification: FlowReuseClassification
  aiResponse: string
  lifecycleStatus?: FlowLifecycleStatus
  finalizedAt?: string | null
  historyRecordIds?: string[]
  selectedFunctionalDocumentIds?: string[]
}

export interface SavedFlowSummary {
  ticketId: string
  title: string
  updatedAt: string
  projectId: string
  moduleId: string
  status: RetestStatus
  lifecycleStatus: FlowLifecycleStatus
  finalizedAt?: string | null
  environment: string
  version: string
  currentStep: number
  framesCount: number
  scenariosCount: number
  historyRecordsCount?: number
  createdByUserId?: string
  ownerName?: string
}

export interface HistoricalTestMetadataDraft {
  flowScenario: string
  bugId: string
  criticality: ReuseCriticality
  tags: string[]
  hasAutomation: boolean
  automationFramework: AutomationFramework
  specPath: string
  impactedModuleIds: string[]
}

export interface HistoricalEvidenceFrameSummary {
  id: string
  name: string
  imageUrl: string
  description?: string
  fileName?: string
}

export interface HistoricalTestRecord {
  id: string
  ticketId: string
  bugId?: string
  projectId: string
  modulePrincipalId: string
  portalArea: string
  fluxoCenario: string
  resumoProblema: string
  comportamentoEsperado: string
  comportamentoObtido: string
  resultadoFinal: RetestStatus
  criticidade: ReuseCriticality
  modulosImpactados: string[]
  tags: string[]
  temAutomacao: boolean
  frameworkAutomacao?: AutomationFramework | ''
  caminhoSpec?: string
  dataCriacao: string
  chamadoTitulo?: string
  documentoWordUrl?: string
  bugWordUrl?: string
  evidencias: HistoricalEvidenceFrameSummary[]
  relatedHistoryIds: string[]
  createdByUserId?: string
  ownerName?: string
}

export type HistoricalRecommendationType = 'historico_relacionado' | 'regressao_sugerida'

export interface HistoricalTestRecommendation extends HistoricalTestRecord {
  type: HistoricalRecommendationType
  impactScore: number
  relevanceScore: number
  matchReasons: string[]
  chamado: string
  projeto: string
  modulo: string
  portalAreaLabel: string
  automacao: 'sim' | 'nao'
  spec: string
}

export interface HistoricalTestSavePayload {
  ticketId: string
  bugId?: string
  projectId: string
  modulePrincipalId: string
  portalArea: string
  fluxoCenario: string
  resumoProblema: string
  comportamentoEsperado: string
  comportamentoObtido: string
  resultadoFinal: RetestStatus
  criticidade: ReuseCriticality
  modulosImpactados: string[]
  tags: string[]
  temAutomacao: boolean
  frameworkAutomacao?: AutomationFramework | ''
  caminhoSpec?: string
  chamadoTitulo?: string
}

export type PromptAnalysisMode =
  | 'diagnostico_funcional'
  | 'diagnostico_repositorio'
  | 'testeplan_gherkin'
  | 'avaliacao_cypress'
