import type {
  CypressBuilderFailureContextResponse,
  CypressBuilderFailureRunResultInput,
  CypressBuilderPreviewOptions,
  CypressBuilderPreviewResponse,
  CypressBuilderRunnerBlueprint,
  AutomationBatteryResult,
  AutomationExecutionResult,
  AutomationFramework,
  AutomationRunHistory,
  AutomationRunHistoryItem,
  AutomationWorkspaceStructureResponse,
} from '@/types/cypress-builder'

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.message || `Falha ao processar ${response.url}`)
  }

  return body as T
}

export async function previewCypressBuilder(payload: {
  blueprint: unknown
  options: CypressBuilderPreviewOptions
}) {
  const response = await fetch('/api/automation/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<CypressBuilderPreviewResponse>(response)
}

export async function generateCypressFailureContext(payload: {
  runResult: CypressBuilderFailureRunResultInput
  blueprint: unknown
}) {
  const response = await fetch('/api/automation/failure-context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<CypressBuilderFailureContextResponse>(response)
}

export async function scaffoldAutomationWorkspace(payload: {
  framework: AutomationFramework
  workspaceRoot: string
  projectName: string
  moduleName: string
  submoduleName: string
  suiteName: string
}) {
  const response = await fetch('/api/automation/workspace-structure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<AutomationWorkspaceStructureResponse>(response)
}

export async function runAutomationSpec(payload: {
  framework: AutomationFramework
  workingDir: string
  command?: string
  specPath?: string
  baseUrl?: string
  env?: Record<string, string>
}) {
  const response = await fetch('/api/automation/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<AutomationExecutionResult>(response)
}

export async function runAutomationBattery(payload: {
  battery: {
    name: string
    framework: AutomationFramework
    workingDir: string
    baseUrl?: string
    env?: Record<string, string>
    items: Array<{
      name: string
      specPath?: string
      command?: string
    }>
  }
}) {
  const response = await fetch('/api/automation/batteries/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<AutomationBatteryResult>(response)
}

export async function listAutomationRuns(limit = 30) {
  const response = await fetch(`/api/automation/runs?limit=${encodeURIComponent(String(limit))}`)
  return parseJson<{ runs: AutomationRunHistory[] }>(response)
}

export async function getAutomationRun(runId: string) {
  const response = await fetch(`/api/automation/runs/${encodeURIComponent(runId)}`)
  return parseJson<{ run: AutomationRunHistory }>(response)
}

export async function listAutomationRunItems(runId: string) {
  const response = await fetch(`/api/automation/runs/${encodeURIComponent(runId)}/items`)
  return parseJson<{ run: AutomationRunHistory; items: AutomationRunHistoryItem[] }>(response)
}

export async function generateAutomationRunFailureContext(runId: string) {
  const response = await fetch(`/api/automation/runs/${encodeURIComponent(runId)}/failure-context`)
  return parseJson<CypressBuilderFailureContextResponse>(response)
}

export const CYPRESS_BUILDER_EXAMPLE_BLUEPRINT: CypressBuilderRunnerBlueprint = {
  id: 'smart-session-example',
  name: 'login admin',
  project: {
    id: 1,
    name: 'Projeto exemplo',
  },
  startUrl: 'https://hml.exemplo.com.br/',
  environment: 'hml',
  steps: [
    {
      order: 1,
      action: 'click',
      target: {
        strategy: 'text',
        selector: 'button',
        text: 'Admin',
        recommendedCommand: 'contains',
        fallbackSelector: 'button',
      },
      value: null,
      variableName: null,
      expectedResult: '',
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: "Adicionar data-testid='admin'",
    },
    {
      order: 2,
      action: 'type',
      target: {
        strategy: 'css',
        selector: "input[type='password']",
        text: null,
        recommendedCommand: 'get',
        fallbackSelector: "form input[type='password']",
      },
      value: '{{password}}',
      variableName: 'password',
      expectedResult: '',
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: "Adicionar data-testid='password'",
    },
  ],
}
