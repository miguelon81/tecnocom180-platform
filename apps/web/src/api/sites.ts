import type { Site } from '../types/site'
import { apiFetch } from './client'

export interface CreateSiteInput {
  organizationId: string
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  country?: string
  active?: boolean
}

export interface UpdateSiteInput {
  organizationId?: string
  name?: string
  code?: string
  address?: string
  city?: string
  state?: string
  country?: string
  active?: boolean
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json()

    if (data?.error) {
      return data.error
    }
  } catch {
    // Ignore invalid JSON response
  }

  return `Error HTTP ${response.status}`
}

function normalizeSite(site: Site): Site {
  return {
    ...site,
    address: site.address ?? null,
    city: site.city ?? null,
    state: site.state ?? null,
    country: site.country ?? null,
    active: site.active ?? true,
    organization: site.organization ?? {
      id: site.organizationId,
      name: '',
      slug: '',
      phone: null,
      email: null,
      timezone: 'America/Mexico_City',
      active: true,
    },
    areas: Array.isArray(site.areas)
      ? site.areas
      : [],
    rooms: Array.isArray(site.rooms)
      ? site.rooms
      : [],
    devices: Array.isArray(site.devices)
      ? site.devices
      : [],
  }
}

export async function getSites(): Promise<Site[]> {
  const response = await apiFetch('/sites')

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data)
    ? data.map(normalizeSite)
    : []
}

export async function createSite(
  data: CreateSiteInput,
): Promise<Site> {
  const response = await apiFetch('/sites', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const createdSite = await response.json()

  return normalizeSite(createdSite)
}

export async function updateSite(
  id: string,
  data: UpdateSiteInput,
): Promise<Site> {
  const response = await apiFetch(`/sites/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const updatedSite = await response.json()

  return normalizeSite(updatedSite)
}

export async function deleteSite(id: string): Promise<void> {
  const response = await apiFetch(`/sites/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}