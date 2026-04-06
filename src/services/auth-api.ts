export interface AuthUser {
  userId: string
  name: string
  email: string
  role: string
  canViewAll: boolean
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export async function getCurrentSession() {
  const response = await fetch('/api/auth/me')
  return parseJson<AuthUser>(response)
}

export async function loginWithPassword(payload: { email: string; password: string }) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<AuthUser>(response)
}

export async function logoutSession() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
  })

  return parseJson<{ ok: true }>(response)
}
