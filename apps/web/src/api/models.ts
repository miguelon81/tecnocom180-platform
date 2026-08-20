import { apiFetch } from './client'

export interface DeviceModel {
  id: string
  brandId: string
  name: string
  type: string
  brand?: {
    id: string
    name: string
  } | null
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

export async function getModels(): Promise<DeviceModel[]> {
  const response = await apiFetch('/models')

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data) ? data : []
}
