import { useQuery } from '@tanstack/react-query'

export interface CatalogOption {
  id: string
  nome: string
}

export interface CatalogModulo extends CatalogOption {
  projetoId: string
  portalId?: string
  portalNome?: string
}

export interface CatalogProjectPortal extends CatalogOption {
  projetoId: string
}

export interface DeleteProjectSummary {
  deletedProjectId: string
  deletedProjectName: string
  deletedPortals: number
  deletedModules: number
  deletedDocuments: number
  deletedTickets: number
  deletedBugs: number
  deletedHistoricalTests: number
  deletedTestPlans: number
  deletedDemandas: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}`)
  }

  return response.json() as Promise<T>
}

export function useCatalogProjectsQuery() {
  return useQuery({
    queryKey: ['catalog-projects'],
    queryFn: () => fetchJson<CatalogOption[]>('/api/projetos'),
  })
}

export function useCatalogAreasQuery() {
  return useQuery({
    queryKey: ['catalog-areas'],
    queryFn: () => fetchJson<CatalogOption[]>('/api/areas'),
  })
}

export function useCatalogModulesQuery(projectId?: string) {
  return useQuery({
    queryKey: ['catalog-modules', projectId],
    queryFn: () => listCatalogModules(projectId || ''),
    enabled: Boolean(projectId),
  })
}

export function useCatalogProjectPortalsQuery(projectId?: string) {
  return useQuery({
    queryKey: ['catalog-project-portals', projectId],
    queryFn: () => listCatalogProjectPortals(projectId || ''),
    enabled: Boolean(projectId),
  })
}

export function listCatalogModules(projectId: string) {
  return fetchJson<CatalogModulo[]>(`/api/modulos?projetoId=${projectId}`)
}

export function listCatalogProjectPortals(projectId: string) {
  return fetchJson<CatalogProjectPortal[]>(`/api/projeto-portais?projetoId=${projectId}`)
}

export async function createCatalogModule(payload: { projetoId: string; nome: string; portalId?: string }) {
  const response = await fetch('/api/modulos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || 'Nao foi possivel cadastrar o modulo.')
  }

  return response.json() as Promise<CatalogModulo>
}

export async function createCatalogProjectPortal(payload: { projetoId: string; nome: string }) {
  const response = await fetch('/api/projeto-portais', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || 'Nao foi possivel cadastrar o local de teste do projeto.')
  }

  return response.json() as Promise<CatalogProjectPortal>
}

export async function deleteCatalogProject(projectId: string) {
  const response = await fetch(`/api/projetos/${projectId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const detail = errorBody?.detail ? ` Detalhe: ${errorBody.detail}` : ''
    throw new Error(`${errorBody?.message || 'Nao foi possivel excluir o projeto.'}${detail}`)
  }

  return response.json() as Promise<DeleteProjectSummary>
}
