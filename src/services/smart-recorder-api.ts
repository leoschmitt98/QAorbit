export interface SmartRecorderStep {
  id: string
  sessionId: string
  order: number
  action: 'click' | 'type' | 'select' | 'check' | 'uncheck' | 'submit' | 'assertion' | 'assertText' | 'assertVisible'
  title: string
  currentUrl: string
  selectorRecommended: string
  selectorFallback: string
  selectorReason: string
  elementText: string
  tagName: string
  elementType: string
  elementId: string
  elementName: string
  dataTestId: string
  dataCy: string
  dataTest: string
  ariaLabel: string
  roleName: string
  classes: string
  inputValue: string
  valueMode: string
  htmlSnippet: string
  expectedResult: string
  notes: string
  createdAt: string | null
  updatedAt: string | null
}

export interface SmartRecorderSession {
  id: string
  projectId: string
  projectName: string
  name: string
  startUrl: string
  environment: string
  status: string
  notes: string
  captureToken?: string
  createdAt: string | null
  updatedAt: string | null
  finalizedAt: string | null
  steps: SmartRecorderStep[]
}

export interface SmartRecorderExport {
  blueprint: unknown
  pageObjectSuggestion: string
  cypressStepsSuggestion: string
  prompt: string
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.message || `Falha ao processar ${response.url}`)
  }
  return body as T
}

export async function createSmartRecorderSession(payload: {
  projectId: string
  name: string
  startUrl: string
  environment: string
  notes: string
}) {
  const response = await fetch('/api/smart-recorder/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<SmartRecorderSession>(response)
}

export async function getSmartRecorderSession(sessionId: string) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}`)
  return parseJson<SmartRecorderSession>(response)
}

export async function createSmartRecorderStep(sessionId: string, payload: Partial<SmartRecorderStep>) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<SmartRecorderStep>(response)
}

export async function updateSmartRecorderStep(sessionId: string, stepId: string, payload: Partial<SmartRecorderStep>) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/steps/${encodeURIComponent(stepId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<SmartRecorderSession>(response)
}

export async function deleteSmartRecorderStep(sessionId: string, stepId: string) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/steps/${encodeURIComponent(stepId)}`, {
    method: 'DELETE',
  })
  return parseJson<SmartRecorderSession>(response)
}

export async function finalizeSmartRecorderSession(sessionId: string) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/finalize`, {
    method: 'POST',
  })
  return parseJson<SmartRecorderSession>(response)
}

export async function pauseSmartRecorderSession(sessionId: string) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/pause`, {
    method: 'POST',
  })
  return parseJson<SmartRecorderSession>(response)
}

export async function resumeSmartRecorderSession(sessionId: string) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/resume`, {
    method: 'POST',
  })
  return parseJson<SmartRecorderSession>(response)
}

export async function exportSmartRecorderJson(sessionId: string) {
  const response = await fetch(`/api/smart-recorder/sessions/${encodeURIComponent(sessionId)}/export-json`)
  return parseJson<SmartRecorderExport>(response)
}
