import { useQuery } from '@tanstack/react-query'

const STORAGE_KEY = 'qa-orbit:qa-runner-configs'

export type QaRunnerSelectorKind = 'input' | 'button' | 'link' | 'select' | 'custom'

export interface QaRunnerSelectorField {
  id: string
  name: string
  selector: string
  kind: QaRunnerSelectorKind
  required: boolean
  notes: string
}

export interface QaRunnerConfig {
  id: string
  name: string
  projectId: string
  projectName: string
  baseUrl: string
  username: string
  password: string
  selectors: QaRunnerSelectorField[]
  updatedAt: string
}

function readConfigs(): QaRunnerConfig[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QaRunnerConfig[]) : []
  } catch {
    return []
  }
}

function writeConfigs(configs: QaRunnerConfig[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export function listQaRunnerConfigs() {
  return readConfigs().sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function saveQaRunnerConfig(config: QaRunnerConfig) {
  const configs = readConfigs()
  const nextConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  }
  const existingIndex = configs.findIndex((item) => item.id === nextConfig.id)

  if (existingIndex >= 0) {
    configs[existingIndex] = nextConfig
  } else {
    configs.unshift(nextConfig)
  }

  writeConfigs(configs)
  return nextConfig
}

export function deleteQaRunnerConfig(configId: string) {
  writeConfigs(readConfigs().filter((item) => item.id !== configId))
}

export function createQaRunnerId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useQaRunnerConfigsQuery() {
  return useQuery({
    queryKey: ['qa-runner-configs'],
    queryFn: listQaRunnerConfigs,
  })
}
