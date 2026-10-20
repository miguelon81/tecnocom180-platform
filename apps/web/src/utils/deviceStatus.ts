export const AGENT_STALE_MS = 90 * 1000
export const IOT_STALE_MS = 5 * 60 * 60 * 1000

type DeviceStatusInput = {
  online: boolean
  lastSeenAt?: string | null
  model?: {
    type?: string | null
  } | null
}

type TelemetryStatusInput = {
  createdAt: string
}

function isRecentDate(
  value: string | null | undefined,
  maxAgeMs: number,
) {
  if (!value) return false

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) return false

  return Date.now() - timestamp <= maxAgeMs
}

export function isDeviceEffectivelyOnline(
  device: DeviceStatusInput,
  telemetry?: TelemetryStatusInput | null,
) {
  if (device.model?.type === 'AGENT') {
    return (
      device.online &&
      isRecentDate(
        device.lastSeenAt,
        AGENT_STALE_MS,
      )
    )
  }

  if (device.model?.type === 'IOT') {
    const lastCommunication =
      device.lastSeenAt ??
      telemetry?.createdAt

    return isRecentDate(
      lastCommunication,
      IOT_STALE_MS,
    )
  }

  return device.online
}