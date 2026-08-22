import { apiFetch } from './client'

export type Organization = {
  id: string
  name: string
  slug: string
  phone?: string | null
  email?: string | null
  timezone?: string | null
  active: boolean
  createdAt?: string
  updatedAt?: string
  sites?: Array<{
    id: string
    name: string
  }>
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

export async function getOrganizations(): Promise<Organization[]> {
  const response = await apiFetch('/organizations')

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data) ? data : []
}

export async function getOrganization(
  id: string,
): Promise<Organization> {
  const response = await apiFetch(
    `/organizations/${encodeURIComponent(id)}`,
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function createOrganization(data: {
  name: string
  slug: string
  phone?: string | null
  email?: string | null
  timezone?: string | null
}): Promise<Organization> {
  const response = await apiFetch('/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function updateOrganization(
  id: string,
  data: {
    name?: string
    slug?: string
    phone?: string | null
    email?: string | null
    timezone?: string | null
    active?: boolean
  },
): Promise<Organization> {
  const response = await apiFetch(
    `/organizations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function deleteOrganization(
  id: string,
): Promise<void> {
  const response = await apiFetch(
    `/organizations/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}
