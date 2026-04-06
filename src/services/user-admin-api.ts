export interface AdminUserRecord {
  userId: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string | null
  updatedAt: string | null
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || `Falha ao processar ${response.url}`)
  }

  return response.json() as Promise<T>
}

export async function listAdminUsers() {
  const response = await fetch('/api/auth/users')
  return parseJson<AdminUserRecord[]>(response)
}

export async function createAdminUser(payload: { name: string; email: string; password: string; role: string }) {
  const response = await fetch('/api/auth/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJson<{ name: string; email: string; role: string }>(response)
}
