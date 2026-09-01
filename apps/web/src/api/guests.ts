import { apiFetch } from './client'

export type GuestWifiStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'DEACTIVATED'

export interface GuestWifiAccess {
  id: string
  stayId: string
  username: string | null
  password: string | null
  accessUrl: string | null
  token: string
  status: GuestWifiStatus
  activatedAt: string | null
  expiresAt: string
  deactivatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GuestRoom {
  id: string
  siteId: string
  areaId: string | null
  number: string
  floor: number | null
  status: string
}

export interface GuestStay {
  id: string
  guestId: string
  roomId: string
  checkIn: string
  checkOut: string
  actualCheckIn: string | null
  actualCheckOut: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  room: GuestRoom
  wifiAccess: GuestWifiAccess | null
}

export interface GuestSite {
  id: string
  organizationId: string
  name: string
  code: string
}

export interface Guest {
  id: string
  siteId: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
  site: GuestSite
  stays: GuestStay[]
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const data = await response.json()

      if (data?.error) {
        message = data.error
      }
    } catch {
      // Keep default message
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export async function getGuests(siteId?: string): Promise<Guest[]> {
  const query = siteId
    ? `?siteId=${encodeURIComponent(siteId)}`
    : ''

  const response = await apiFetch(`/guests${query}`)

  return parseResponse<Guest[]>(response)
}

export async function getGuest(id: string): Promise<Guest> {
  const response = await apiFetch(`/guests/${id}`)

  return parseResponse<Guest>(response)
}

export async function createGuest(data: {
  siteId: string
  name: string
  email?: string
  phone?: string
}): Promise<Guest> {
  const response = await apiFetch('/guests', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  return parseResponse<Guest>(response)
}

export async function createGuestStay(
  guestId: string,
  data: {
    roomId: string
    checkIn: string
    checkOut: string
    notes?: string
  },
): Promise<GuestStay> {
  const response = await apiFetch(`/guests/${guestId}/stays`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  return parseResponse<GuestStay>(response)
}

export async function createGuestWifi(
  guestId: string,
  stayId: string,
): Promise<{
  wifiAccess: GuestWifiAccess
  guest: Guest
  room: GuestRoom
  stay: {
    id: string
    checkIn: string
    checkOut: string
    status: string
  }
}> {
  const response = await apiFetch(
    `/guests/${guestId}/stays/${stayId}/wifi`,
    {
      method: 'POST',
    },
  )

  return parseResponse(response)
}

export async function activateGuestWifi(
  guestId: string,
  stayId: string,
): Promise<{
  wifiAccess: GuestWifiAccess
  guest: Guest
  room: GuestRoom
  stay: {
    id: string
    checkIn: string
    checkOut: string
    status: string
  }
  mode: string
}> {
  const response = await apiFetch(
    `/guests/${guestId}/stays/${stayId}/wifi/activate`,
    {
      method: 'POST',
    },
  )

  return parseResponse(response)
}