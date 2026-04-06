import { useQuery } from '@tanstack/react-query'
import type { BugPriority, BugRecord, BugSeverity, BugStatus, BugReproductionStep, BugEvidenceDraft, QaFlowDraftPayload } from '@/types/domain'

export interface BugSummary {
  id: string
  ticketId: string
  title: string
  status: BugStatus
  severity: BugSeverity
  priority: BugPriority
  createdAt: string
  updatedAt: string
  projectId: string
  projectName: string
  moduleId?: string
  moduleName: string
  createdByUserId?: string
  ownerName?: string
}

export interface BugDetailResponse {
  bug: BugRecord
  workflow: QaFlowDraftPayload
  evidenceFrames: Array<{
    id: string
    fileName: string
    description?: string
    downloadUrl: string
  }>
}

interface SaveBugPayload {
  ticketId: string
  title: string
  expectedBehavior: string
  obtainedBehavior: string
  severity: BugSeverity
  priority: BugPriority
  status: BugStatus
  reproductionSteps: BugReproductionStep[]
  evidence: BugEvidenceDraft
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export function useBugsQuery(scope: 'mine' | 'all' = 'mine') {
  return useQuery({
    queryKey: ['stored-bugs', scope],
    queryFn: async () => {
      const response = await fetch(`/api/bugs?scope=${encodeURIComponent(scope)}`)
      return parseJson<BugSummary[]>(response)
    },
  })
}

export function useBugQuery(bugId?: string) {
  return useQuery({
    queryKey: ['stored-bug', bugId],
    queryFn: async () => {
      const response = await fetch(`/api/bugs/${encodeURIComponent(bugId || '')}`)
      return parseJson<BugDetailResponse>(response)
    },
    enabled: Boolean(bugId),
  })
}

export async function saveBug(bugId: string, payload: SaveBugPayload) {
  const response = await fetch(`/api/bugs/${encodeURIComponent(bugId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<{ ok: true; bug: BugRecord }>(response)
}

export async function downloadBugDocx(bugId: string) {
  const response = await fetch(`/api/bugs/${encodeURIComponent(bugId)}/export-docx`)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || 'Nao foi possivel gerar o Word do bug.')
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `relato-bug-${bugId}.docx`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url)
  }, 30_000)
}
