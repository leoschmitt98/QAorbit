export interface StoredScenarioFramePayload {
  ticketId: string
  scenarioId: string
  imageDataUrl: string
  timestampLabel: string
  description?: string
}

export interface StoredScenarioFrameResponse {
  id: string
  fileName: string
  imageUrl: string
  downloadUrl: string
  persistedAt: string
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export async function saveScenarioFrame(payload: StoredScenarioFramePayload) {
  const response = await fetch('/api/quadros/cenario', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<StoredScenarioFrameResponse>(response)
}

export async function deleteScenarioFrame(ticketId: string, scenarioId: string, fileName: string) {
  const response = await fetch(
    `/api/quadros/cenario/${encodeURIComponent(ticketId)}/${encodeURIComponent(scenarioId)}/${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
    },
  )

  return parseJson<{ ok: true }>(response)
}

export async function updateScenarioFrameMetadata(
  ticketId: string,
  scenarioId: string,
  fileName: string,
  payload: { description?: string; timestampLabel?: string },
) {
  const response = await fetch(
    `/api/quadros/cenario/${encodeURIComponent(ticketId)}/${encodeURIComponent(scenarioId)}/${encodeURIComponent(fileName)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJson<{ ok: true }>(response)
}
