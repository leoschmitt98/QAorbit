import { useQuery } from '@tanstack/react-query'
import type { TestPlanDetail, TestPlanRecord, TestPlanStepRecord } from '@/types/domain'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export interface CreateTestPlanPayload {
  titulo: string
  objetivo: string
  projectId: string
  moduleId: string
  areaId?: string
  chamadoIdOrigem?: string
  bugIdOrigem?: string
  tipo?: string
  criticidade?: string
  incluirEmRegressao?: boolean
}

export interface UpdateTestPlanPayload {
  titulo?: string
  objetivo?: string
  projectId?: string
  moduleId?: string
  areaId?: string
  tipo?: string
  criticidade?: string
  incluirEmRegressao?: boolean
}

export interface CreateTestPlanStepPayload {
  acao: string
  resultadoEsperado: string
}

export interface UpdateTestPlanStepPayload {
  acao?: string
  resultadoEsperado?: string
  ordem?: number
}

export function useTestPlansQuery(scope: 'mine' | 'all' = 'mine') {
  return useQuery({
    queryKey: ['test-plans', scope],
    queryFn: async () => {
      const response = await fetch(`/api/test-plans?scope=${encodeURIComponent(scope)}`)
      return parseJson<TestPlanRecord[]>(response)
    },
  })
}

export function useTestPlanDetailQuery(testPlanId?: string) {
  return useQuery({
    queryKey: ['test-plan', testPlanId],
    queryFn: async () => {
      const response = await fetch(`/api/test-plans/${encodeURIComponent(testPlanId || '')}`)
      return parseJson<TestPlanDetail>(response)
    },
    enabled: Boolean(testPlanId),
  })
}

export async function createTestPlan(payload: CreateTestPlanPayload) {
  const response = await fetch('/api/test-plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<TestPlanRecord>(response)
}

export async function updateTestPlan(testPlanId: string, payload: UpdateTestPlanPayload) {
  const response = await fetch(`/api/test-plans/${encodeURIComponent(testPlanId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<TestPlanRecord>(response)
}

export async function createTestPlanStep(testPlanId: string, payload: CreateTestPlanStepPayload) {
  const response = await fetch(`/api/test-plans/${encodeURIComponent(testPlanId)}/steps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<TestPlanStepRecord>(response)
}

export async function updateTestPlanStep(testPlanId: string, stepId: string, payload: UpdateTestPlanStepPayload) {
  const response = await fetch(`/api/test-plans/${encodeURIComponent(testPlanId)}/steps/${encodeURIComponent(stepId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<TestPlanStepRecord>(response)
}

export async function deleteTestPlanStep(testPlanId: string, stepId: string) {
  const response = await fetch(`/api/test-plans/${encodeURIComponent(testPlanId)}/steps/${encodeURIComponent(stepId)}`, {
    method: 'DELETE',
  })

  return parseJson<{ ok: true }>(response)
}

export async function finalizeTestPlan(testPlanId: string) {
  const response = await fetch(`/api/test-plans/${encodeURIComponent(testPlanId)}/finalizar`, {
    method: 'PATCH',
  })

  return parseJson<TestPlanRecord>(response)
}
