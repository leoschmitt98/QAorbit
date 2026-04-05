import { useQuery } from '@tanstack/react-query'
import type { DocumentItem } from '@/types/domain'

interface FunctionalDocsFilters {
  projectId?: string
  moduleId?: string
  search?: string
}

interface UploadFunctionalDocumentPayload {
  title: string
  type: DocumentItem['type']
  projectId: string
  projectName: string
  moduleId: string
  moduleName: string
  version: string
  summary: string
  tags: string[]
  author: string
  fileName: string
  fileDataUrl: string
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export function useFunctionalDocumentsQuery(filters: FunctionalDocsFilters = {}) {
  return useQuery({
    queryKey: ['functional-documents', filters.projectId || '', filters.moduleId || '', filters.search || ''],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (filters.projectId) searchParams.set('projectId', filters.projectId)
      if (filters.moduleId) searchParams.set('moduleId', filters.moduleId)
      if (filters.search) searchParams.set('search', filters.search)
      const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
      const response = await fetch(`/api/documentos-funcionais${suffix}`)
      return parseJson<DocumentItem[]>(response)
    },
  })
}

export function useFunctionalDocumentQuery(documentId?: string) {
  return useQuery({
    queryKey: ['functional-document', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documentos-funcionais/${encodeURIComponent(documentId || '')}`)
      return parseJson<DocumentItem>(response)
    },
    enabled: Boolean(documentId),
  })
}

export async function uploadFunctionalDocument(payload: UploadFunctionalDocumentPayload) {
  const response = await fetch('/api/documentos-funcionais', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<DocumentItem>(response)
}
