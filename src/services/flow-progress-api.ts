import type { QaFlowDraftPayload, SavedFlowSummary } from '@/types/domain'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export async function saveFlowProgress(ticketId: string, payload: QaFlowDraftPayload) {
  const response = await fetch(`/api/chamados/${encodeURIComponent(ticketId)}/progresso`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<{ ok: true; updatedAt: string }>(response)
}

export async function loadFlowProgress(ticketId: string) {
  const response = await fetch(`/api/chamados/${encodeURIComponent(ticketId)}/progresso`)
  return parseJson<QaFlowDraftPayload & { updatedAt: string }>(response)
}

export async function listSavedFlows() {
  const response = await fetch('/api/chamados/progressos')
  return parseJson<SavedFlowSummary[]>(response)
}

export async function updateFlowLifecycleStatus(ticketId: string, lifecycleStatus: 'Em andamento' | 'Finalizado') {
  const response = await fetch(`/api/chamados/${encodeURIComponent(ticketId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lifecycleStatus }),
  })

  return parseJson<{ ok: true; lifecycleStatus: 'Em andamento' | 'Finalizado'; finalizedAt: string | null; updatedAt: string }>(
    response,
  )
}
