import type { Site } from '../types/site'

const API_URL = 'http://localhost:3000'

export async function getSites(): Promise<Site[]> {
  const response = await fetch(`${API_URL}/sites`)

  if (!response.ok) {
    throw new Error(`Error al obtener sitios: ${response.status}`)
  }

  return response.json()
}