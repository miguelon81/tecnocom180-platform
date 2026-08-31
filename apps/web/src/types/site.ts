export type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'MAINTENANCE'
  | 'CLEANING'

export interface Organization {
  id: string
  name: string
  slug: string
  phone: string | null
  email: string | null
  timezone: string
  active: boolean
}

export interface Area {
  id: string
  siteId: string
  name: string
  type: string | null
}

export interface Room {
  id: string
  siteId: string
  areaId: string | null
  number: string
  floor: number
  status: RoomStatus
}

export interface Device {
  id: string
  deviceCode: string | null
  siteId: string
  areaId: string | null
  modelId: string | null
  hostname: string
  serial: string | null
  ip: string | null
  mac: string | null
  firmware: string | null
  online: boolean
  installedAt: string | null
  model: {
    id: string
    name: string
    type: string
    brand: {
      id: string
      name: string
    } | null
  } | null
}

export interface Site {
  id: string
  organizationId: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  active: boolean
  organization: Organization
  areas: Area[]
  rooms: Room[]
  devices: Device[]
}

export interface SitesResponse {
  value: Site[]
  Count: number
}
