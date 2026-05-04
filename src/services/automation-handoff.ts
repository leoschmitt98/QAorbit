import type { QaRunnerRunResult, QaRunnerSuite } from '@/services/qa-runner-api'
import type { AutomationFramework } from '@/types/cypress-builder'

const QA_RUNNER_FAILURE_HANDOFF_KEY = 'qa-orbit:qa-runner-failure-handoff'

export interface QaRunnerFailureHandoff {
  source: 'qa-runner'
  capturedAt: string
  framework: AutomationFramework
  projectName: string
  suiteName: string
  suiteSpec: string
  baseUrl: string
  workspacePath: string
  runResult: QaRunnerRunResult
}

export function saveQaRunnerFailureHandoff(payload: {
  projectName: string
  suite: QaRunnerSuite | null
  baseUrl: string
  workspacePath: string
  runResult: QaRunnerRunResult
}) {
  if (typeof window === 'undefined') return

  const handoff: QaRunnerFailureHandoff = {
    source: 'qa-runner',
    capturedAt: new Date().toISOString(),
    framework: 'cypress',
    projectName: payload.projectName,
    suiteName: payload.suite?.name || payload.runResult.spec || 'Suite Cypress',
    suiteSpec: payload.suite?.spec || payload.runResult.spec || '',
    baseUrl: payload.baseUrl,
    workspacePath: payload.workspacePath,
    runResult: payload.runResult,
  }

  window.localStorage.setItem(QA_RUNNER_FAILURE_HANDOFF_KEY, JSON.stringify(handoff))
}

export function consumeQaRunnerFailureHandoff() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(QA_RUNNER_FAILURE_HANDOFF_KEY)
    if (!raw) return null
    window.localStorage.removeItem(QA_RUNNER_FAILURE_HANDOFF_KEY)
    return JSON.parse(raw) as QaRunnerFailureHandoff
  } catch {
    window.localStorage.removeItem(QA_RUNNER_FAILURE_HANDOFF_KEY)
    return null
  }
}
