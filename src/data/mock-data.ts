import type {
  ActivityItem,
  AgentDefinition,
  AnalysisRecord,
  BugItem,
  DashboardMetrics,
  DocumentItem,
  EvidenceItem,
  ExecutionItem,
  Module,
  Project,
  QaFlowRecord,
} from '@/types/domain'

export const projects: Project[] = []

export const modules: Module[] = []

export const documents: DocumentItem[] = []

export const bugs: BugItem[] = []

export const executions: ExecutionItem[] = []

export const evidences: EvidenceItem[] = []

export const dashboardMetrics: DashboardMetrics = {
  totalProjects: 0,
  totalBugs: 0,
  testsInProgress: 0,
  testsCompleted: 0,
  recentEvidence: 0,
  recentDocuments: 0,
}

export const activities: ActivityItem[] = []

export const agents: AgentDefinition[] = [
  {
    id: 'agent-flow-analysis',
    name: 'Analise de Fluxo',
    description: 'Cruza chamado, changelog do dev, historico e artefatos alterados para investigar onde a correcao pode estar incompleta ou fora da regra.',
    focus: 'diagnostico tecnico e funcional',
    recommendedFor: 'hotfix com suspeita em artefatos, regra de negocio ou impacto lateral',
    executor: 'Codex no repositorio',
    requiresLinkedTicket: true,
    expectedOutput: 'Diagnostico tecnico, regra atendida ou violada, riscos e pontos do fluxo para revisar.',
    promptMode: 'diagnostico_repositorio',
    suggestedStep: 1,
  },
  {
    id: 'agent-gherkin-plan',
    name: 'Teste Plan Gherkin',
    description: 'Transforma chamado, documentacao e reteste em cenarios Given/When/Then claros para regressao manual e automacao futura.',
    focus: 'formalizacao funcional',
    recommendedFor: 'estruturar cenario reutilizavel antes de liberar ou automatizar',
    executor: 'ChatGPT ou Codex',
    requiresLinkedTicket: true,
    expectedOutput: 'Cenarios Gherkin principais, negativos, pre-condicoes e criterios de aceite.',
    promptMode: 'testeplan_gherkin',
    suggestedStep: 3,
  },
  {
    id: 'agent-cypress',
    name: 'Automacao Cypress',
    description: 'Avalia se o fluxo vale automatizacao, define escopo de regressao e propõe estrutura inicial de spec com base no chamado e no historico.',
    focus: 'viabilidade de automacao',
    recommendedFor: 'fluxos repetiveis, regressivos e com alto valor de cobertura',
    executor: 'Codex no repositorio',
    requiresLinkedTicket: true,
    expectedOutput: 'Decisao sobre automatizar, sugestao de spec Cypress, asserts e riscos de fragilidade.',
    promptMode: 'avaliacao_cypress',
    suggestedStep: 5,
  },
]

export const analyses: AnalysisRecord[] = []

export const qaFlows: QaFlowRecord[] = []
