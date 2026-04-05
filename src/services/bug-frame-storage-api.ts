import type { StoredFrameResponse } from '@/services/frame-storage-api'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export async function saveBugFrame(payload: {
  ticketId: string
  bugId: string
  imageDataUrl: string
  timestampLabel: string
  description?: string
}) {
  const response = await fetch(`/api/bugs/${encodeURIComponent(payload.bugId)}/quadros`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<StoredFrameResponse>(response)
}

export async function deleteBugFrame(ticketId: string, bugId: string, fileName: string) {
  const response = await fetch(
    `/api/bugs/${encodeURIComponent(bugId)}/quadros/${encodeURIComponent(ticketId)}/${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
    },
  )

  return parseJson<{ ok: true }>(response)
}

export async function updateBugFrameMetadata(
  ticketId: string,
  bugId: string,
  fileName: string,
  payload: { description?: string; timestampLabel?: string },
) {
  const response = await fetch(
    `/api/bugs/${encodeURIComponent(bugId)}/quadros/${encodeURIComponent(ticketId)}/${encodeURIComponent(fileName)}`,
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
