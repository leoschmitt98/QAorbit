import { useQuery } from '@tanstack/react-query'
import type { DemandaCenarioEvidenciaRecord, DemandaCenarioRecord, DemandaDetail, DemandaRecord, DemandaTarefaRecord } from '@/types/domain'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export interface CreateDemandaPayload {
  titulo: string
  descricao: string
  projectId: string
  status?: string
  prioridade?: string
  responsavelId?: string
}

export interface UpdateDemandaPayload {
  titulo?: string
  descricao?: string
  projectId?: string
  status?: string
  prioridade?: string
  responsavelId?: string
}

export interface CreateDemandaTarefaPayload {
  titulo: string
  descricao?: string
  portalId?: string
  areaId?: string
  moduleId?: string
  status?: string
  ordem?: number
}

export interface UpdateDemandaTarefaPayload {
  titulo?: string
  descricao?: string
  portalId?: string
  areaId?: string
  moduleId?: string
  status?: string
  ordem?: number
}

export interface CreateDemandaCenarioPayload {
  titulo: string
  descricao?: string
  tipo?: string
  status?: string
  observacoes?: string
}

export interface UpdateDemandaCenarioPayload {
  titulo?: string
  descricao?: string
  tipo?: string
  status?: string
  observacoes?: string
}

export interface CreateDemandaCenarioEvidenciaPayload {
  nomeArquivo: string
  arquivoDataUrl: string
  legenda?: string
  ordem?: number
}

export interface StoredDemandaScenarioFramePayload {
  demandaId: string
  tarefaId: string
  cenarioId: string
  imageDataUrl: string
  timestampLabel: string
  description?: string
}

export interface StoredDemandaScenarioFrameResponse {
  id: string
  fileName: string
  imageUrl: string
  downloadUrl: string
  persistedAt: string
}

export function useDemandasQuery(scope: 'mine' | 'all' = 'mine') {
  return useQuery({
    queryKey: ['demandas', scope],
    queryFn: async () => {
      const response = await fetch(`/api/demandas?scope=${encodeURIComponent(scope)}`)
      return parseJson<DemandaRecord[]>(response)
    },
  })
}

export function useDemandaDetailQuery(demandaId?: string) {
  return useQuery({
    queryKey: ['demanda', demandaId],
    queryFn: async () => {
      const response = await fetch(`/api/demandas/${encodeURIComponent(demandaId || '')}`)
      return parseJson<DemandaDetail>(response)
    },
    enabled: Boolean(demandaId),
  })
}

export function useDemandaScenarioDetailQuery(demandaId?: string, tarefaId?: string, cenarioId?: string) {
  return useQuery({
    queryKey: ['demanda', demandaId, 'tarefa', tarefaId, 'cenario', cenarioId],
    queryFn: async () => {
      const response = await fetch(
        `/api/demandas/${encodeURIComponent(demandaId || '')}/tarefas/${encodeURIComponent(tarefaId || '')}/cenarios/${encodeURIComponent(cenarioId || '')}`,
      )
      return parseJson<DemandaCenarioRecord>(response)
    },
    enabled: Boolean(demandaId && tarefaId && cenarioId && cenarioId !== 'novo'),
  })
}

export async function createDemanda(payload: CreateDemandaPayload) {
  const response = await fetch('/api/demandas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJson<DemandaRecord>(response)
}

export async function updateDemanda(demandaId: string, payload: UpdateDemandaPayload) {
  const response = await fetch(`/api/demandas/${encodeURIComponent(demandaId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJson<DemandaRecord>(response)
}

export async function deleteDemanda(demandaId: string) {
  const response = await fetch(`/api/demandas/${encodeURIComponent(demandaId)}`, {
    method: 'DELETE',
  })

  return parseJson<{ ok: true }>(response)
}

export async function downloadDemandaCenariosDocx(demandaId: string, scenarioIds: string[]) {
  const response = await fetch(`/api/demandas/${encodeURIComponent(demandaId)}/export-cenarios-docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || 'Nao foi possivel gerar o documento dos cenarios.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i)
  const fileName = fileNameMatch?.[1] || `cenarios-${demandaId}.docx`
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)

  return { fileName }
}

export async function createDemandaTarefa(demandaId: string, payload: CreateDemandaTarefaPayload) {
  const response = await fetch(`/api/demandas/${encodeURIComponent(demandaId)}/tarefas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJson<DemandaTarefaRecord>(response)
}

export async function updateDemandaTarefa(
  demandaId: string,
  tarefaId: string,
  payload: UpdateDemandaTarefaPayload,
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<DemandaTarefaRecord>(response)
}

export async function deleteDemandaTarefa(demandaId: string, tarefaId: string) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}`,
    {
      method: 'DELETE',
    },
  )

  return parseJson<{ ok: true }>(response)
}

export async function createDemandaCenario(
  demandaId: string,
  tarefaId: string,
  payload: CreateDemandaCenarioPayload,
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<DemandaCenarioRecord>(response)
}

export async function updateDemandaCenario(
  demandaId: string,
  tarefaId: string,
  cenarioId: string,
  payload: UpdateDemandaCenarioPayload,
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios/${encodeURIComponent(cenarioId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<DemandaCenarioRecord>(response)
}

export async function deleteDemandaCenario(demandaId: string, tarefaId: string, cenarioId: string) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios/${encodeURIComponent(cenarioId)}`,
    {
      method: 'DELETE',
    },
  )

  return parseJson<{ ok: true }>(response)
}

export async function createDemandaCenarioEvidencia(
  demandaId: string,
  tarefaId: string,
  cenarioId: string,
  payload: CreateDemandaCenarioEvidenciaPayload,
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios/${encodeURIComponent(cenarioId)}/evidencias`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<DemandaCenarioEvidenciaRecord>(response)
}

export async function deleteDemandaCenarioEvidencia(
  demandaId: string,
  tarefaId: string,
  cenarioId: string,
  evidenciaId: string,
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios/${encodeURIComponent(cenarioId)}/evidencias/${encodeURIComponent(evidenciaId)}`,
    {
      method: 'DELETE',
    },
  )

  return parseJson<{ ok: true }>(response)
}

export async function saveDemandaScenarioFrame(payload: StoredDemandaScenarioFramePayload) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(payload.demandaId)}/tarefas/${encodeURIComponent(payload.tarefaId)}/cenarios/${encodeURIComponent(payload.cenarioId)}/quadros`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<StoredDemandaScenarioFrameResponse>(response)
}

export async function deleteDemandaScenarioFrame(
  demandaId: string,
  tarefaId: string,
  cenarioId: string,
  fileName: string,
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios/${encodeURIComponent(cenarioId)}/quadros/${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
    },
  )

  return parseJson<{ ok: true }>(response)
}

export async function updateDemandaScenarioFrameMetadata(
  demandaId: string,
  tarefaId: string,
  cenarioId: string,
  fileName: string,
  payload: { description?: string; timestampLabel?: string },
) {
  const response = await fetch(
    `/api/demandas/${encodeURIComponent(demandaId)}/tarefas/${encodeURIComponent(tarefaId)}/cenarios/${encodeURIComponent(cenarioId)}/quadros/${encodeURIComponent(fileName)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<{ ok: true }>(response)
}
