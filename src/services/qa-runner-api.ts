import { useQuery } from '@tanstack/react-query'

const WORKSPACE_STORAGE_KEY = 'qa-orbit:qa-runner-workspaces'

export interface QaRunnerWorkspace {
  projectId: string
  projectName: string
  workspacePath: string
  updatedAt: string
}

export interface QaRunnerSuite {
  id: string
  name: string
  spec: string
  description: string
  requiredParams: string[]
  tags: string[]
  absoluteSpecPath: string
}

export interface QaRunnerSuitesResponse {
  workspacePath: string
  source: 'manifest' | 'scan'
  projectKey: string
  projectName: string
  suites: QaRunnerSuite[]
}

export interface QaRunnerRunResult {
  ok: boolean
  status: 'passed' | 'failed'
  exitCode: number
  command: string
  workspacePath: string
  spec: string
  startedAt: string
  finishedAt: string
  durationMs: number
  stdout: string
  stderr: string
  error: string
}

export interface QaRunnerBatchRunItem extends QaRunnerRunResult {
  suiteId: string
  suiteName: string
}

export interface QaRunnerBatchRunResult {
  ok: boolean
  status: 'passed' | 'failed'
  totalSuites: number
  passedSuites: number
  failedSuites: number
  startedAt: string
  finishedAt: string
  durationMs: number
  results: QaRunnerBatchRunItem[]
}

export interface QaRunnerDirectoryEntry {
  name: string
  path: string
}

export interface QaRunnerDirectoryResponse {
  currentPath: string
  parentPath: string
  entries: QaRunnerDirectoryEntry[]
}

export interface QaRunnerChooseDirectoryResponse {
  canceled: boolean
  selectedPath: string
}

function readWorkspaces(): QaRunnerWorkspace[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QaRunnerWorkspace[]) : []
  } catch {
    return []
  }
}

function writeWorkspaces(workspaces: QaRunnerWorkspace[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspaces))
}

export function listQaRunnerWorkspaces() {
  return readWorkspaces()
}

export function getQaRunnerWorkspace(projectId: string) {
  return readWorkspaces().find((item) => item.projectId === projectId) ?? null
}

export function saveQaRunnerWorkspace(workspace: Omit<QaRunnerWorkspace, 'updatedAt'>) {
  const workspaces = readWorkspaces()
  const nextWorkspace = {
    ...workspace,
    updatedAt: new Date().toISOString(),
  }
  const existingIndex = workspaces.findIndex((item) => item.projectId === workspace.projectId)

  if (existingIndex >= 0) {
    workspaces[existingIndex] = nextWorkspace
  } else {
    workspaces.unshift(nextWorkspace)
  }

  writeWorkspaces(workspaces)
  return nextWorkspace
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.message || `Falha ao processar ${response.url}`)
  }

  return body as T
}

export async function listQaRunnerSuites(workspacePath: string) {
  const response = await fetch('/api/qa-runner/suites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspacePath }),
  })

  return parseJson<QaRunnerSuitesResponse>(response)
}

export async function listQaRunnerDirectories(directoryPath?: string) {
  const params = directoryPath ? `?path=${encodeURIComponent(directoryPath)}` : ''
  const response = await fetch(`/api/qa-runner/directories${params}`)

  return parseJson<QaRunnerDirectoryResponse>(response)
}

export async function chooseQaRunnerDirectory(initialPath?: string) {
  const response = await fetch('/api/qa-runner/choose-directory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initialPath }),
  })

  return parseJson<QaRunnerChooseDirectoryResponse>(response)
}

export async function runQaRunnerSuite(payload: {
  projectId: string
  projectName: string
  workspacePath: string
  spec: string
  baseUrl: string
  username: string
  password: string
  extraEnv: Record<string, string>
}) {
  const response = await fetch('/api/qa-runner/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<QaRunnerRunResult>(response)
}

export async function runQaRunnerSuites(payload: {
  projectId: string
  projectName: string
  workspacePath: string
  suites: Array<{ id: string; name: string; spec: string }>
  baseUrl: string
  username: string
  password: string
  extraEnv: Record<string, string>
}) {
  const response = await fetch('/api/qa-runner/run-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<QaRunnerBatchRunResult>(response)
}

export function useQaRunnerWorkspacesQuery() {
  return useQuery({
    queryKey: ['qa-runner-workspaces'],
    queryFn: listQaRunnerWorkspaces,
  })
}
