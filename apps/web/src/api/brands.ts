import { apiFetch } from './client'

export interface Brand {
  id: string
  name: string
  models?: DeviceModel[]
}

export interface DeviceModel {
  id: string
  brandId: string
  name: string
  type: string
  brand?: Brand | null
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

export async function getBrands(): Promise<Brand[]> {
  const response = await apiFetch('/brands')

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data) ? data : []
}
