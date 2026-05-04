export type CypressBuilderSpecMode = 'runner_based' | 'expanded'
export type AutomationTestType = 'web-e2e' | 'api' | 'performance' | 'security'
export type AutomationFramework = 'cypress' | 'playwright' | 'selenium'
export type AutomationLanguage = 'javascript' | 'typescript' | 'java' | 'python'
export type AutomationPattern = 'simple' | 'pageObject' | 'gherkin'

export interface CypressBuilderRunnerTarget {
  strategy: 'css' | 'text'
  selector: string
  text: string | null
  recommendedCommand: 'get' | 'contains' | ''
  fallbackSelector?: string
}

export interface CypressBuilderRunnerStep {
  order: number
  action: string
  target?: CypressBuilderRunnerTarget
  value?: string | null
  variableName?: string | null
  expectedResult?: string
  selectorQuality?: 'strong' | 'medium' | 'weak' | string
  warning?: string
  improvementSuggestion?: string
}

export interface CypressBuilderRunnerBlueprint {
  id?: string
  name: string
  project?: {
    id?: number | string
    name?: string
  }
  startUrl?: string
  environment?: string
  steps: CypressBuilderRunnerStep[]
}

export interface CypressBuilderPreviewOptions {
  suiteName: string
  specMode: CypressBuilderSpecMode
  fixtureFileName: string
  specFileName: string
  moduleName?: string
  submoduleName?: string
  framework?: AutomationFramework
  type?: AutomationTestType
  language?: AutomationLanguage
  pattern?: AutomationPattern
  baseUrl?: string
  specName?: string
}

export interface CypressBuilderWarning {
  code: string
  message: string
  level: 'warning'
  stepOrder?: number | null
}

export interface CypressBuilderPreviewResponse {
  blueprint: CypressBuilderRunnerBlueprint
  neutralBlueprint?: unknown
  framework?: AutomationFramework
  fixtureJson: string
  specCode: string
  warnings: CypressBuilderWarning[]
  suggestedPaths: {
    fixturePath: string
    specPath: string
  }
}

export interface CypressBuilderFailureRunResultInput {
  framework?: AutomationFramework
  command?: string
  suiteName: string
  specPath: string
  workspacePath: string
  baseUrl: string
  exitCode: number
  durationMs: number
  stdout: string
  stderr: string
}

export interface CypressBuilderDetectedFailure {
  message: string
  selector: string
  stepOrder: number | null
  action: string
  confidence: 'low' | 'medium' | 'high'
  recommendedCommand?: string
  selectorQuality?: string
}

export interface CypressBuilderFailureContextResponse {
  contextText: string
  detectedFailure: CypressBuilderDetectedFailure
  warnings: CypressBuilderWarning[]
}

export interface AutomationWorkspaceStructureResponse {
  framework: AutomationFramework | string
  workspaceRoot: string
  workingDir: string
  createdPaths: {
    projectRoot: string
    specDir: string
    fixtureDir: string
    helperPath: string
    manifestPath: string
    readmePath: string
  }
  suggestedPaths: {
    specPath: string
    fixturePath: string
  }
  commands: {
    openInVscode: string
    openInCursor: string
    enterDir: string
    npmInstall: string
    frameworkInstall: string
    openFramework: string
  }
  createdFiles: string[]
  warnings: string[]
}

export interface AutomationExecutionResult {
  status: 'passed' | 'failed' | 'error'
  framework: AutomationFramework
  command: string
  workingDir: string
  exitCode: number
  durationMs: number
  stdout: string
  stderr: string
  artifacts: {
    screenshots: string[]
    videos: string[]
    traces: string[]
    reports: string[]
  }
  summary: {
    total?: number
    passed?: number
    failed?: number
    skipped?: number
  }
  mainError?: string
  warnings: string[]
  runId?: string | null
}

export interface AutomationBatteryResult {
  status: 'passed' | 'failed' | 'partial' | 'error'
  startedAt: string
  finishedAt: string
  durationMs: number
  total: number
  passed: number
  failed: number
  results: AutomationExecutionResult[]
  runId?: string | null
}

export interface AutomationRunHistory {
  id: string
  name: string
  type: 'single' | 'battery' | string
  framework: AutomationFramework | string
  baseUrl: string
  status: 'passed' | 'failed' | 'partial' | 'error' | string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number
  total: number
  passed: number
  failed: number
  createdAt: string | null
}

export interface AutomationRunArtifact {
  id: number
  runItemId: string
  type: string
  path: string
  createdAt: string | null
}

export interface AutomationRunHistoryItem {
  id: string
  runId: string
  specName: string
  specPath: string
  framework: AutomationFramework | string
  status: string
  exitCode: number
  durationMs: number
  mainError: string
  stdoutSanitized: string
  stderrSanitized: string
  command: string
  baseUrl: string
  createdAt: string | null
  artifacts: AutomationRunArtifact[]
}
