export interface StoredFramePayload {
  ticketId: string
  imageDataUrl: string
  timestampLabel: string
  description?: string
}

export interface StoredFrameResponse {
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

export async function saveCapturedFrame(payload: StoredFramePayload) {
  const response = await fetch('/api/quadros', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<StoredFrameResponse>(response)
}

export async function deleteCapturedFrameFile(ticketId: string, fileName: string) {
  const response = await fetch(`/api/quadros/${encodeURIComponent(ticketId)}/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  })

  return parseJson<{ ok: true }>(response)
}

export async function updateCapturedFrameMetadata(
  ticketId: string,
  fileName: string,
  payload: { description?: string; timestampLabel?: string },
) {
  const response = await fetch(`/api/quadros/${encodeURIComponent(ticketId)}/${encodeURIComponent(fileName)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<{ ok: true }>(response)
}
