import { apiFetch } from './client'

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'RECEPTION'
  | 'TECHNICIAN'

export type User = {
  id: string
  organizationId: string
  name: string
  email: string
  phone?: string | null
  role: UserRole
  active: boolean
  lastLogin?: string | null
  createdAt?: string
  updatedAt?: string
  organization?: {
    id: string
    name: string
  } | null
}

export type CreateUserInput = {
  organizationId: string
  name: string
  email: string
  passwordHash: string
  phone?: string | null
  role: UserRole
}

export type UpdateUserInput = {
  name?: string
  email?: string
  passwordHash?: string
  phone?: string | null
  role?: UserRole
  active?: boolean
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json()

    if (data?.error) {
      return data.error
    }
  } catch {
    // Ignore invalid JSON
  }

  return `Error HTTP ${response.status}`
}

export async function getUsers(
  organizationId?: string,
): Promise<User[]> {
  const query = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : ''

  const response = await apiFetch(`/users${query}`)

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data) ? data : []
}

export async function createUser(
  data: CreateUserInput,
): Promise<User> {
  const response = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
): Promise<User> {
  const response = await apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function deactivateUser(
  id: string,
): Promise<User> {
  const response = await apiFetch(`/users/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}
