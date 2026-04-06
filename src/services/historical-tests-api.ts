import type {
  HistoricalTestRecommendation,
  HistoricalTestRecord,
  HistoricalTestSavePayload,
} from '@/types/domain'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export async function listHistoricalTests(scope: 'mine' | 'all' = 'mine') {
  const response = await fetch(`/api/historico-testes?scope=${encodeURIComponent(scope)}`)
  return parseJson<HistoricalTestRecord[]>(response)
}

export async function loadHistoricalTest(recordId: string) {
  const response = await fetch(`/api/historico-testes/${encodeURIComponent(recordId)}`)
  return parseJson<HistoricalTestRecord>(response)
}

export async function saveHistoricalTest(payload: HistoricalTestSavePayload) {
  const response = await fetch('/api/historico-testes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<HistoricalTestRecord>(response)
}

export interface RelatedHistoricalTestsParams {
  projeto: string
  moduloPrincipal: string
  portalArea: string
  fluxoCenario?: string
  resumoProblema?: string
  tags?: string[]
  modulosImpactados?: string[]
}

export async function listRelatedHistoricalTests(params: RelatedHistoricalTestsParams) {
  const searchParams = new URLSearchParams()
  searchParams.set('projeto', params.projeto)
  searchParams.set('moduloPrincipal', params.moduloPrincipal)
  searchParams.set('portalArea', params.portalArea)
  if (params.fluxoCenario?.trim()) searchParams.set('fluxoCenario', params.fluxoCenario.trim())
  if (params.resumoProblema?.trim()) searchParams.set('resumoProblema', params.resumoProblema.trim())
  if (params.tags?.length) searchParams.set('tags', params.tags.join(','))
  if (params.modulosImpactados?.length) searchParams.set('modulosImpactados', params.modulosImpactados.join(','))

  const response = await fetch(`/api/historico-testes/relacionados?${searchParams.toString()}`)
  return parseJson<HistoricalTestRecommendation[]>(response)
}
