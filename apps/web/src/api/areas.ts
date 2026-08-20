import type { Area } from '../types/site'
import { apiFetch } from './client'

export interface CreateAreaInput {
  siteId: string
  name: string
  type?: string
}

export interface UpdateAreaInput {
  siteId?: string
  name?: string
  type?: string
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

function normalizeArea(area: Area): Area {
  return {
    ...area,
    type: area.type ?? null,
  }
}

export async function getAreas(
  siteId?: string,
): Promise<Area[]> {
  const query = siteId
    ? `?siteId=${encodeURIComponent(siteId)}`
    : ''

  const response = await apiFetch(`/areas${query}`)

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data)
    ? data.map(normalizeArea)
    : []
}

export async function createArea(
  data: CreateAreaInput,
): Promise<Area> {
  const response = await apiFetch('/areas', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return normalizeArea(await response.json())
}

export async function updateArea(
  id: string,
  data: UpdateAreaInput,
): Promise<Area> {
  const response = await apiFetch(`/areas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return normalizeArea(await response.json())
}

export async function deleteArea(
  id: string,
): Promise<void> {
  const response = await apiFetch(`/areas/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}