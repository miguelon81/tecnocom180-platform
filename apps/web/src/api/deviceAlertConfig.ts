import { apiFetch } from './client'

export type DeviceAlertConfig = {
  deviceId: string
  enabled: boolean
  lowLevelThreshold: number
  recoveryLevelThreshold: number
  lowBatteryThreshold: number | null
}

export type UpdateDeviceAlertConfigInput = {
  enabled?: boolean
  lowLevelThreshold?: number | null
  recoveryLevelThreshold?: number | null
}

async function parseResponse(
  response: Response,
): Promise<DeviceAlertConfig> {
  if (!response.ok) {
    const data = await response.json().catch(() => null)

    throw new Error(
      data?.error ?? 'Error al consultar la configuración de alertas',
    )
  }

  return response.json() as Promise<DeviceAlertConfig>
}

export async function getDeviceAlertConfig(
  deviceId: string,
): Promise<DeviceAlertConfig> {
  const response = await apiFetch(
    `/devices/${encodeURIComponent(deviceId)}/alert-config`,
  )

  return parseResponse(response)
}

export async function updateDeviceAlertConfig(
  deviceId: string,
  input: UpdateDeviceAlertConfigInput,
): Promise<DeviceAlertConfig> {
  const response = await apiFetch(
    `/devices/${encodeURIComponent(deviceId)}/alert-config`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )

  return parseResponse(response)
}