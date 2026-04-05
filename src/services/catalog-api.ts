import { useQuery } from '@tanstack/react-query'

export interface CatalogOption {
  id: string
  nome: string
}

export interface CatalogModulo extends CatalogOption {
  projetoId: string
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

export function listCatalogModules(projectId: string) {
  return fetchJson<CatalogModulo[]>(`/api/modulos?projetoId=${projectId}`)
}

export async function createCatalogModule(payload: { projetoId: string; nome: string }) {
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
