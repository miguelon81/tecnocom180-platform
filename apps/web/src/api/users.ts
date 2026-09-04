import { apiFetch } from './client'

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'OPERATIONS'
  | 'RECEPTION'
  | 'TECHNICIAN'

export type OrganizationSummary = {
  id: string
  name: string
  slug?: string
}

export type UserSiteAssignment = {
  id: string
  siteId: string
  createdAt?: string
  site: {
    id: string
    organizationId: string
    name: string
    code: string
    active: boolean
  }
}

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
  organization?: OrganizationSummary | null
  sites: UserSiteAssignment[]
}

export type CreateUserInput = {
  organizationId?: string
  name: string
  email: string
  passwordHash: string
  phone?: string | null
  role: UserRole
  siteIds?: string[]
}

export type UpdateUserInput = {
  organizationId?: string
  name?: string
  email?: string
  passwordHash?: string
  phone?: string | null
  role?: UserRole
  active?: boolean
  siteIds?: string[]
}

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  const text = await response.text()

  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
    ) {
      throw new Error(data.error)
    }

    throw new Error(
      typeof data === 'string'
        ? data
        : `Request failed with status ${response.status}`,
    )
  }

  return data as T
}

// ============================================================
// GET /users
// ============================================================

export async function getUsers(
  organizationId?: string,
): Promise<User[]> {
  const query = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : ''

  const response = await apiFetch(`/users${query}`)

  return parseResponse<User[]>(response)
}

// ============================================================
// GET /users/:id
// ============================================================

export async function getUser(
  id: string,
): Promise<User> {
  const response = await apiFetch(`/users/${id}`)

  return parseResponse<User>(response)
}

// ============================================================
// POST /users
// ============================================================

export async function createUser(
  data: CreateUserInput,
): Promise<User> {
  const response = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  return parseResponse<User>(response)
}

// ============================================================
// PATCH /users/:id
// ============================================================

export async function updateUser(
  id: string,
  data: UpdateUserInput,
): Promise<User> {
  const response = await apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

  return parseResponse<User>(response)
}

// ============================================================
// DELETE /users/:id
// Soft delete = desactivar usuario
// ============================================================

export async function deactivateUser(
  id: string,
): Promise<User> {
  const response = await apiFetch(`/users/${id}`, {
    method: 'DELETE',
  })

  return parseResponse<User>(response)
}