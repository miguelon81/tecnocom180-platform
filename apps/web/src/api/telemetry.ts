import { apiFetch } from './client'

export interface DeviceTelemetry {
  id: string
  deviceId: string
  nivel: number | null
  bateria: number | null
  senal: number | null
  recarga: number | null
  consumo: number | null
  relay1: number | null
  createdAt: string
}

export interface DeviceTelemetryResponse {
  deviceId: string
  deviceCode: string
  telemetry: DeviceTelemetry
}

export interface DeviceTelemetryHistoryResponse {
  deviceId: string
  deviceCode: string
  telemetry: DeviceTelemetry[]
}

async function parseError(
  response: Response,
): Promise<string> {
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

export async function getLatestTelemetry(
  deviceId: string,
): Promise<DeviceTelemetryResponse> {
  const response = await apiFetch(
    `/devices/${deviceId}/telemetry/latest`,
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

export async function getTelemetry(
  deviceId: string,
): Promise<DeviceTelemetryHistoryResponse> {
  const response = await apiFetch(
    `/devices/${deviceId}/telemetry`,
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}