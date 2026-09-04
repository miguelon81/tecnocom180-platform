import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { apiFetch } from '../api/client'
import { useSites } from '../sites/SiteContext'

const HOTEL_CHECK_IN_TIME = '14:00'
const HOTEL_CHECK_OUT_TIME = '12:00'
const QR_AUTO_CLOSE_MS = 60_000

type WifiAccess = {
  id: string
  stayId: string
  username: string | null
  password: string | null
  accessUrl: string | null
  token: string
  status:
    | 'PENDING'
    | 'ACTIVE'
    | 'EXPIRED'
    | 'DISABLED'
  activatedAt: string | null
  expiresAt: string
  deactivatedAt: string | null
  maxDevices?: number
}

type Room = {
  id: string
  number: string
  floor: number | null
  status: string
}

type Stay = {
  id: string
  roomId: string
  checkIn: string
  checkOut: string
  actualCheckIn: string | null
  actualCheckOut: string | null
  status:
    | 'RESERVED'
    | 'CHECKED_IN'
    | 'CHECKED_OUT'
    | 'CANCELLED'
  notes: string | null
  wifiMaxDevices?: number
  room: Room
  wifiAccess: WifiAccess | null
}

type Guest = {
  id: string
  siteId: string
  name: string
  email: string | null
  phone: string | null
  stays: Stay[]
}

type WifiQrInfo = {
  wifi: WifiAccess
  guestName: string
  roomNumber: string
  maxDevices: number
}

export default function GuestsPage() {
  const {
    sites,
    selectedSiteId,
    selectedSite,
    loading: sitesLoading,
    error: sitesError,
    setSelectedSiteId,
  } = useSites()

  const [guests, setGuests] = useState<Guest[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [error, setError] = useState('')

  const [showReservationForm, setShowReservationForm] =
    useState(false)
  const [creatingReservation, setCreatingReservation] =
    useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roomId, setRoomId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [notes, setNotes] = useState('')
  const [wifiMaxDevices, setWifiMaxDevices] = useState(2)

  const [actionId, setActionId] =
    useState<string | null>(null)

  const [qrWifi, setQrWifi] =
    useState<WifiQrInfo | null>(null)

  const [, setCurrentTimeTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTimeTick((value) => value + 1)
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!qrWifi) {
      return
    }

    const timeout = window.setTimeout(() => {
      setQrWifi(null)
    }, QR_AUTO_CLOSE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [qrWifi])

  async function loadGuests(
    siteId: string = selectedSiteId ?? '',
  ) {
    if (!siteId) {
      setGuests([])
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await apiFetch(
        `/guests?siteId=${encodeURIComponent(siteId)}`,
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudieron cargar los huéspedes',
        )
      }

      setGuests(Array.isArray(data) ? data : [])
    } catch (err) {
      setGuests([])
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los huéspedes',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadRooms(
    siteId: string = selectedSiteId ?? '',
  ) {
    if (!siteId) {
      setRooms([])
      return
    }

    try {
      setLoadingRooms(true)

      const response = await apiFetch(
        `/rooms?siteId=${encodeURIComponent(siteId)}`,
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudieron cargar las habitaciones',
        )
      }

      setRooms(Array.isArray(data) ? data : [])
    } catch (err) {
      setRooms([])
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las habitaciones',
      )
    } finally {
      setLoadingRooms(false)
    }
  }

  useEffect(() => {
    setShowReservationForm(false)
    setQrWifi(null)
    resetReservationForm()
    setGuests([])
    setRooms([])
    setError('')

    if (!selectedSiteId) {
      setLoading(false)
      setLoadingRooms(false)
      return
    }

    void Promise.all([
      loadGuests(selectedSiteId),
      loadRooms(selectedSiteId),
    ])
  }, [selectedSiteId])

  function resetReservationForm() {
    setName('')
    setEmail('')
    setPhone('')
    setRoomId('')
    setCheckIn('')
    setCheckOut('')
    setNotes('')
    setWifiMaxDevices(2)
  }

  function buildHotelDateTime(
    date: string,
    time: string,
  ): Date {
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = time.split(':').map(Number)

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes)
    ) {
      return new Date(Number.NaN)
    }

    const result = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0,
      ),
    )

    if (
      result.getUTCFullYear() !== year ||
      result.getUTCMonth() !== month - 1 ||
      result.getUTCDate() !== day ||
      result.getUTCHours() !== hours ||
      result.getUTCMinutes() !== minutes
    ) {
      return new Date(Number.NaN)
    }

    return result
  }

  function openReservationForm() {
    setError('')
    resetReservationForm()
    setShowReservationForm(true)

    if (selectedSiteId) {
      void loadRooms(selectedSiteId)
    }
  }

  function closeReservationForm() {
    if (creatingReservation) {
      return
    }

    setShowReservationForm(false)
    resetReservationForm()
    setError('')
  }

  const availableRooms = useMemo(() => {
    if (!checkIn || !checkOut) {
      return []
    }

    const requestedStart =
      buildHotelDateTime(
        checkIn,
        HOTEL_CHECK_IN_TIME,
      )

    const requestedEnd =
      buildHotelDateTime(
        checkOut,
        HOTEL_CHECK_OUT_TIME,
      )

    if (
      Number.isNaN(requestedStart.getTime()) ||
      Number.isNaN(requestedEnd.getTime()) ||
      requestedEnd <= requestedStart
    ) {
      return []
    }

    return rooms.filter((room) => {
      if (
        room.status === 'MAINTENANCE' ||
        room.status === 'CLEANING'
      ) {
        return false
      }

      const hasConflict = guests.some(
        (guest) =>
          guest.stays.some((stay) => {
            if (
              stay.roomId !== room.id ||
              (stay.status !== 'RESERVED' &&
                stay.status !== 'CHECKED_IN')
            ) {
              return false
            }

            const existingStart =
              new Date(stay.checkIn)
            const existingEnd =
              new Date(stay.checkOut)

            if (
              Number.isNaN(existingStart.getTime()) ||
              Number.isNaN(existingEnd.getTime())
            ) {
              return false
            }

            return (
              requestedStart < existingEnd &&
              requestedEnd > existingStart
            )
          }),
      )

      return !hasConflict
    })
  }, [
    rooms,
    guests,
    checkIn,
    checkOut,
  ])

  useEffect(() => {
    if (
      roomId &&
      !availableRooms.some(
        (room) => room.id === roomId,
      )
    ) {
      setRoomId('')
    }
  }, [availableRooms, roomId])

  async function handleCreateReservation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!selectedSiteId) {
      setError('No hay un sitio seleccionado')
      return
    }

    if (!name.trim()) {
      setError(
        'El nombre del huésped es obligatorio',
      )
      return
    }

    if (!checkIn) {
      setError(
        'La fecha de entrada es obligatoria',
      )
      return
    }

    if (!checkOut) {
      setError(
        'La fecha de salida es obligatoria',
      )
      return
    }

    const start = buildHotelDateTime(
      checkIn,
      HOTEL_CHECK_IN_TIME,
    )

    const end = buildHotelDateTime(
      checkOut,
      HOTEL_CHECK_OUT_TIME,
    )

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setError(
        'Las fechas de entrada y salida no son válidas',
      )
      return
    }

    if (end <= start) {
      setError(
        'La fecha de salida debe ser posterior a la fecha de entrada',
      )
      return
    }

    if (!roomId) {
      setError('La habitación es obligatoria')
      return
    }

    const selectedRoomIsAvailable =
      availableRooms.some(
        (room) => room.id === roomId,
      )

    if (!selectedRoomIsAvailable) {
      setError(
        'La habitación seleccionada ya no está disponible para esas fechas',
      )
      return
    }

    try {
      setCreatingReservation(true)
      setError('')

      const response = await apiFetch(
        '/guests/reservations',
        {
          method: 'POST',
          body: JSON.stringify({
            siteId: selectedSiteId,
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            roomId,
            checkIn: start.toISOString(),
            checkOut: end.toISOString(),
            notes: notes.trim() || null,
            wifiMaxDevices,
          }),
        },
      )

      const data = await response.json().catch(() => null)

      if (response.status === 409) {
        setRoomId('')

        await Promise.all([
          loadGuests(selectedSiteId),
          loadRooms(selectedSiteId),
        ])

        throw new Error(
          'La habitación seleccionada acaba de ser reservada para esas fechas. Selecciona otra habitación.',
        )
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudo crear la reserva',
        )
      }

      setShowReservationForm(false)
      resetReservationForm()

      await Promise.all([
        loadGuests(selectedSiteId),
        loadRooms(selectedSiteId),
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la reserva',
      )
    } finally {
      setCreatingReservation(false)
    }
  }

  async function executeAction(
    id: string,
    action: string,
  ) {
    if (!selectedSiteId) {
      setError('No hay un sitio seleccionado')
      return
    }

    try {
      setActionId(id)
      setError('')

      const response = await apiFetch(
        action,
        {
          method: 'POST',
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudo ejecutar la operación',
        )
      }

      await Promise.all([
        loadGuests(selectedSiteId),
        loadRooms(selectedSiteId),
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo ejecutar la operación',
      )
    } finally {
      setActionId(null)
    }
  }

  async function handleCheckIn(
    guest: Guest,
    stay: Stay,
  ) {
    await executeAction(
      `${guest.id}:${stay.id}:checkin`,
      `/guests/${guest.id}/stays/${stay.id}/checkin`,
    )
  }

  async function handleCheckOut(
    guest: Guest,
    stay: Stay,
  ) {
    const confirmed = window.confirm(
      `¿Registrar salida de ${guest.name} de la habitación ${stay.room.number}?`,
    )

    if (!confirmed) {
      return
    }

    await executeAction(
      `${guest.id}:${stay.id}:checkout`,
      `/guests/${guest.id}/stays/${stay.id}/checkout`,
    )
  }

  async function handleCancel(
    guest: Guest,
    stay: Stay,
  ) {
    const confirmed = window.confirm(
      `¿Cancelar la estancia de ${guest.name} en la habitación ${stay.room.number}?`,
    )

    if (!confirmed) {
      return
    }

    await executeAction(
      `${guest.id}:${stay.id}:cancel`,
      `/guests/${guest.id}/stays/${stay.id}/cancel`,
    )
  }

  async function handleCreateWifi(
    guest: Guest,
    stay: Stay,
  ) {
    await executeAction(
      `${guest.id}:${stay.id}:wifi`,
      `/guests/${guest.id}/stays/${stay.id}/wifi`,
    )
  }

  async function handleActivateWifi(
    guest: Guest,
    stay: Stay,
  ) {
    await executeAction(
      `${guest.id}:${stay.id}:wifi-activate`,
      `/guests/${guest.id}/stays/${stay.id}/wifi/activate`,
    )
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString(
      'es-MX',
      {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'UTC',
      },
    )
  }

  function formatShortDate(value: string) {
    return new Date(value).toLocaleDateString(
      'es-MX',
      {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: 'UTC',
      },
    )
  }

  function wifiStatusLabel(
    status: WifiAccess['status'],
  ) {
    switch (status) {
      case 'ACTIVE':
        return 'Activo'
      case 'PENDING':
        return 'Pendiente'
      case 'EXPIRED':
        return 'Expirado'
      case 'DISABLED':
        return 'Desactivado'
      default:
        return status
    }
  }

  function stayStatusLabel(
    status: Stay['status'],
  ) {
    switch (status) {
      case 'RESERVED':
        return 'Reservado'
      case 'CHECKED_IN':
        return 'Hospedado'
      case 'CHECKED_OUT':
        return 'Finalizado'
      case 'CANCELLED':
        return 'Cancelado'
      default:
        return status
    }
  }

  function getCurrentStay(
    guest: Guest,
  ): Stay | undefined {
    const now = Date.now()

    const validStays = guest.stays.filter(
      (stay) =>
        stay.status !== 'CANCELLED' &&
        !Number.isNaN(
          new Date(stay.checkIn).getTime(),
        ) &&
        !Number.isNaN(
          new Date(stay.checkOut).getTime(),
        ),
    )

    const checkedInActive =
      validStays
        .filter((stay) => {
          if (stay.status !== 'CHECKED_IN') {
            return false
          }

          const start =
            new Date(stay.checkIn).getTime()
          const end =
            new Date(stay.checkOut).getTime()

          return now >= start && now < end
        })
        .sort(
          (a, b) =>
            new Date(b.checkIn).getTime() -
            new Date(a.checkIn).getTime(),
        )[0]

    if (checkedInActive) {
      return checkedInActive
    }

    const reservedActive =
      validStays
        .filter((stay) => {
          if (stay.status !== 'RESERVED') {
            return false
          }

          const start =
            new Date(stay.checkIn).getTime()
          const end =
            new Date(stay.checkOut).getTime()

          return now >= start && now < end
        })
        .sort(
          (a, b) =>
            new Date(b.checkIn).getTime() -
            new Date(a.checkIn).getTime(),
        )[0]

    if (reservedActive) {
      return reservedActive
    }

    const nextStay =
      validStays
        .filter(
          (stay) =>
            new Date(stay.checkIn).getTime() > now,
        )
        .sort(
          (a, b) =>
            new Date(a.checkIn).getTime() -
            new Date(b.checkIn).getTime(),
        )[0]

    if (nextStay) {
      return nextStay
    }

    return validStays.sort(
      (a, b) =>
        new Date(b.checkOut).getTime() -
        new Date(a.checkOut).getTime(),
    )[0]
  }

  const currentStaysMap = useMemo(() => {
    const map =
      new Map<string, Stay | undefined>()

    guests.forEach((guest) => {
      map.set(
        guest.id,
        getCurrentStay(guest),
      )
    })

    return map
  }, [guests])

  const visibleGuests = useMemo(() => {
    return [...guests].sort((a, b) => {
      const stayA = currentStaysMap.get(a.id)
      const stayB = currentStaysMap.get(b.id)

      if (!stayA && !stayB) {
        return a.name.localeCompare(b.name)
      }

      if (!stayA) {
        return 1
      }

      if (!stayB) {
        return -1
      }

      const roomCompare =
        stayA.room.number.localeCompare(
          stayB.room.number,
          undefined,
          {
            numeric: true,
          },
        )

      if (roomCompare !== 0) {
        return roomCompare
      }

      return (
        new Date(stayA.checkIn).getTime() -
        new Date(stayB.checkIn).getTime()
      )
    })
  }, [
    guests,
    currentStaysMap,
  ])

  const counters = useMemo(() => {
    let checkedIn = 0
    let reserved = 0

    visibleGuests.forEach((guest) => {
      const stay =
        currentStaysMap.get(guest.id)

      if (stay?.status === 'CHECKED_IN') {
        checkedIn += 1
      }

      if (stay?.status === 'RESERVED') {
        reserved += 1
      }
    })

    return {
      checkedIn,
      reserved,
      total: visibleGuests.length,
    }
  }, [
    visibleGuests,
    currentStaysMap,
  ])

  function renderStayActions(
    guest: Guest,
    stay: Stay,
  ) {
    const busyPrefix =
      `${guest.id}:${stay.id}:`

    const isBusy =
      actionId === `${busyPrefix}checkin` ||
      actionId === `${busyPrefix}checkout` ||
      actionId === `${busyPrefix}cancel`

    return (
      <div className="guest-action-group">
        {stay.status === 'RESERVED' && (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void handleCheckIn(
                  guest,
                  stay,
                )
              }
              className="guest-btn guest-btn-primary guest-btn-small"
            >
              {actionId === `${busyPrefix}checkin`
                ? 'Registrando...'
                : 'Check-in'}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void handleCancel(
                  guest,
                  stay,
                )
              }
              className="guest-btn guest-btn-secondary guest-btn-small"
            >
              {actionId === `${busyPrefix}cancel`
                ? 'Cancelando...'
                : 'Cancelar'}
            </button>
          </>
        )}

        {stay.status === 'CHECKED_IN' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void handleCheckOut(
                guest,
                stay,
              )
            }
            className="guest-btn guest-btn-primary guest-btn-small"
          >
            {actionId === `${busyPrefix}checkout`
              ? 'Registrando...'
              : 'Check-out'}
          </button>
        )}

        {stay.status === 'CHECKED_OUT' && (
          <span className="guest-muted">
            Finalizada
          </span>
        )}
      </div>
    )
  }

  function renderWifiActions(
    guest: Guest,
    stay: Stay,
  ) {
    if (stay.status === 'RESERVED') {
      return (
        <div className="guest-wifi-summary">
          <span className="guest-wifi-dot guest-wifi-dot-pending" />
          <div>
            <strong>Al check-in</strong>
            <small>
              {stay.wifiMaxDevices ?? 2}{' '}
              dispositivos
            </small>
          </div>
        </div>
      )
    }

    const wifi = stay.wifiAccess

    if (!wifi) {
      const id =
        `${guest.id}:${stay.id}:wifi`

      return (
        <button
          type="button"
          disabled={actionId === id}
          onClick={() =>
            void handleCreateWifi(
              guest,
              stay,
            )
          }
          className="guest-btn guest-btn-secondary guest-btn-small"
        >
          {actionId === id
            ? 'Creando...'
            : 'Crear WiFi'}
        </button>
      )
    }

    if (wifi.status === 'PENDING') {
      const id =
        `${guest.id}:${stay.id}:wifi-activate`

      return (
        <button
          type="button"
          disabled={actionId === id}
          onClick={() =>
            void handleActivateWifi(
              guest,
              stay,
            )
          }
          className="guest-btn guest-btn-primary guest-btn-small"
        >
          {actionId === id
            ? 'Activando...'
            : 'Activar WiFi'}
        </button>
      )
    }

    if (wifi.status === 'ACTIVE') {
      const maxDevices =
        wifi.maxDevices ??
        stay.wifiMaxDevices ??
        2

      return (
        <div className="guest-wifi-cell">
          <div className="guest-wifi-summary">
            <span className="guest-wifi-dot guest-wifi-dot-active" />

            <div>
              <strong>
                {wifi.username ||
                  'WiFi activo'}
              </strong>

              <small>
                {maxDevices}{' '}
                {maxDevices === 1
                  ? 'dispositivo'
                  : 'dispositivos'}
              </small>
            </div>
          </div>

          {wifi.accessUrl && (
            <div className="guest-wifi-links">
              <button
                type="button"
                onClick={() =>
                  setQrWifi({
                    wifi,
                    guestName:
                      guest.name,
                    roomNumber:
                      stay.room.number,
                    maxDevices,
                  })
                }
                className="guest-link-button"
              >
                QR
              </button>

            </div>
          )}
        </div>
      )
    }

    return (
      <span className="guest-muted">
        {wifiStatusLabel(wifi.status)}
      </span>
    )
  }

  if (sitesLoading) {
    return (
      <div className="page">
        <h1>Huéspedes</h1>
        <p className="subtitle">
          Cargando sitios...
        </p>
      </div>
    )
  }

  if (sitesError) {
    return (
      <div className="page">
        <h1>Huéspedes</h1>
        <div className="guest-alert guest-alert-error">
          {sitesError}
        </div>
      </div>
    )
  }

  if (!selectedSiteId) {
    return (
      <div className="page">
        <h1>Huéspedes</h1>
        <div className="guest-empty">
          No hay un sitio activo disponible
          para administrar huéspedes.
        </div>
      </div>
    )
  }

  const isGlobalBusy =
    loading ||
    loadingRooms ||
    creatingReservation ||
    actionId !== null

  return (
    <div className="page guest-page">
      <div className="guest-header">
        <div>
          <p className="eyebrow">
            GUEST MANAGER
          </p>

          <h1>
            Huéspedes y estancias
          </h1>

          <p className="subtitle">
            Reservas, check-in, check-out
            y acceso WiFi.
          </p>
        </div>

        <div className="guest-header-actions">
          {sites.filter(
            (site) => site.active,
          ).length > 1 && (
            <div className="guest-field guest-site-field">
              <label>
                Sitio
              </label>

              <select
                value={selectedSiteId}
                onChange={(event) =>
                  setSelectedSiteId(
                    event.target.value,
                  )
                }
                disabled={isGlobalBusy}
              >
                {sites
                  .filter(
                    (site) =>
                      site.active,
                  )
                  .map(
                    (site) => (
                      <option
                        key={site.id}
                        value={site.id}
                      >
                        {site.name} ({site.code})
                      </option>
                    ),
                  )}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!selectedSiteId) {
                return
              }

              void Promise.all([
                loadGuests(
                  selectedSiteId,
                ),
                loadRooms(
                  selectedSiteId,
                ),
              ])
            }}
            disabled={isGlobalBusy}
            className="guest-btn guest-btn-secondary"
          >
            {loading
              ? 'Actualizando...'
              : 'Actualizar'}
          </button>

          <button
            type="button"
            onClick={
              openReservationForm
            }
            disabled={isGlobalBusy}
            className="guest-btn guest-btn-primary"
          >
            + Nueva reserva
          </button>
        </div>
      </div>

      {selectedSite && (
        <div className="guest-site-strip">
          <div>
            <span>Sitio actual</span>
            <strong>
              {selectedSite.name}
            </strong>
            <small>
              {selectedSite.code}
            </small>
          </div>

          <div className="guest-counters">
            <div>
              <strong>
                {counters.checkedIn}
              </strong>
              <span>Hospedados</span>
            </div>

            <div>
              <strong>
                {counters.reserved}
              </strong>
              <span>Reservados</span>
            </div>

            <div>
              <strong>
                {counters.total}
              </strong>
              <span>Registros</span>
            </div>
          </div>
        </div>
      )}

      {showReservationForm && (
        <div className="guest-reservation-card">
          <div className="guest-reservation-head">
            <div>
              <h2>
                Nueva reserva
              </h2>

              <p>
                Registra huésped, estancia
                y acceso WiFi.
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handleCreateReservation
            }
            className="guest-form"
          >
            <section className="guest-form-section">
              <div className="guest-section-title">
                <span>1</span>
                <div>
                  <strong>
                    Huésped
                  </strong>
                  <small>
                    Datos de contacto.
                  </small>
                </div>
              </div>

              <div className="guest-form-grid guest-form-grid-3">
                <div className="guest-field">
                  <label>
                    Nombre *
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    placeholder="Nombre del huésped"
                    autoFocus
                  />
                </div>

                <div className="guest-field">
                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value,
                      )
                    }
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div className="guest-field">
                  <label>
                    Teléfono
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value,
                      )
                    }
                    placeholder="222 000 0000"
                  />
                </div>
              </div>
            </section>

            <section className="guest-form-section">
              <div className="guest-section-title">
                <span>2</span>
                <div>
                  <strong>
                    Estancia
                  </strong>
                  <small>
                    Fechas y habitación.
                  </small>
                </div>
              </div>

              <div className="guest-form-grid guest-form-grid-3">
                <div className="guest-field">
                  <label>
                    Entrada *
                  </label>

                  <input
                    type="date"
                    value={checkIn}
                    onChange={(event) =>
                      setCheckIn(
                        event.target.value,
                      )
                    }
                  />

                  <small>
                    Check-in {HOTEL_CHECK_IN_TIME}
                  </small>
                </div>

                <div className="guest-field">
                  <label>
                    Salida *
                  </label>

                  <input
                    type="date"
                    value={checkOut}
                    onChange={(event) =>
                      setCheckOut(
                        event.target.value,
                      )
                    }
                  />

                  <small>
                    Check-out {HOTEL_CHECK_OUT_TIME}
                  </small>
                </div>

                <div className="guest-field">
                  <label>
                    Habitación *
                  </label>

                  <select
                    value={roomId}
                    onChange={(event) =>
                      setRoomId(
                        event.target.value,
                      )
                    }
                    disabled={
                      loadingRooms ||
                      !checkIn ||
                      !checkOut ||
                      availableRooms.length === 0
                    }
                  >
                    <option value="">
                      {loadingRooms
                        ? 'Cargando habitaciones...'
                        : !checkIn ||
                            !checkOut
                          ? 'Selecciona primero las fechas'
                          : availableRooms.length === 0
                            ? 'Sin habitaciones disponibles'
                            : 'Seleccionar habitación'}
                    </option>

                    {availableRooms.map(
                      (room) => (
                        <option
                          key={room.id}
                          value={room.id}
                        >
                          Hab. {room.number}
                          {room.floor !== null
                            ? ` — Piso ${room.floor}`
                            : ''}
                        </option>
                      ),
                    )}
                  </select>

                  {checkIn &&
                    checkOut && (
                      <small
                        className={
                          availableRooms.length > 0
                            ? ''
                            : 'guest-field-error'
                        }
                      >
                        {availableRooms.length > 0
                          ? `${availableRooms.length} ${
                              availableRooms.length === 1
                                ? 'habitación disponible'
                                : 'habitaciones disponibles'
                            }`
                          : 'No hay habitaciones disponibles para este periodo.'}
                      </small>
                    )}
                </div>
              </div>
            </section>

            <section className="guest-form-section">
              <div className="guest-section-title">
                <span>3</span>
                <div>
                  <strong>
                    WiFi y notas
                  </strong>
                  <small>
                    Política de acceso de la estancia.
                  </small>
                </div>
              </div>

              <div className="guest-form-grid guest-form-grid-wifi">
                <div className="guest-field">
                  <label>
                    Dispositivos permitidos
                  </label>

                  <select
                    value={wifiMaxDevices}
                    onChange={(event) =>
                      setWifiMaxDevices(
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  >
                    {[1, 2, 3, 4, 5].map(
                      (count) => (
                        <option
                          key={count}
                          value={count}
                        >
                          {count}{' '}
                          {count === 1
                            ? 'dispositivo'
                            : 'dispositivos'}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="guest-field">
                  <label>
                    Notas
                  </label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value,
                      )
                    }
                    rows={3}
                    placeholder="Notas de la estancia"
                  />
                </div>
              </div>
            </section>

            <div className="guest-form-actions">
              <button
                type="button"
                onClick={
                  closeReservationForm
                }
                disabled={
                  creatingReservation
                }
                className="guest-btn guest-btn-secondary"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  creatingReservation ||
                  !name.trim() ||
                  !checkIn ||
                  !checkOut ||
                  !roomId
                }
                className="guest-btn guest-btn-primary"
              >
                {creatingReservation
                  ? 'Guardando...'
                  : 'Crear reserva'}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="guest-alert guest-alert-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="guest-empty">
          Cargando huéspedes...
        </div>
      )}

      {!loading &&
        !error &&
        guests.length === 0 && (
          <div className="guest-empty">
            <strong>
              No hay huéspedes
            </strong>
            <span>
              Las reservas registradas
              aparecerán aquí.
            </span>
          </div>
        )}

      {!loading &&
        guests.length > 0 && (
          <div className="guest-table-card">
            <div className="guest-table-scroll">
              <table className="guest-table">
                <thead>
                  <tr>
                    <th>Hab.</th>
                    <th>Huésped</th>
                    <th>Estado</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>WiFi</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleGuests.map(
                    (guest) => {
                      const stay =
                        currentStaysMap.get(
                          guest.id,
                        )

                      if (!stay) {
                        return (
                          <tr key={guest.id}>
                            <td className="guest-room-cell">
                              —
                            </td>

                            <td>
                              <div className="guest-name">
                                {guest.name}
                              </div>

                              <div className="guest-secondary">
                                Sin estancia
                              </div>
                            </td>

                            <td colSpan={5}>
                              <span className="guest-muted">
                                Sin estancia disponible
                              </span>
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={guest.id}>
                          <td className="guest-room-cell">
                            <strong>
                              {stay.room.number}
                            </strong>

                            {stay.room.floor !== null && (
                              <small>
                                Piso {stay.room.floor}
                              </small>
                            )}
                          </td>

                          <td>
                            <div className="guest-name">
                              {guest.name}
                            </div>

                            <div className="guest-secondary">
                              {guest.phone ||
                                guest.email ||
                                `ID ${guest.id.slice(0, 8)}`}
                            </div>

                            {guest.phone &&
                              guest.email && (
                                <div className="guest-tertiary">
                                  {guest.email}
                                </div>
                              )}

                            {stay.notes && (
                              <div
                                className="guest-note"
                                title={stay.notes}
                              >
                                {stay.notes}
                              </div>
                            )}
                          </td>

                          <td>
                            <span
                              className={`guest-status guest-status-${stay.status.toLowerCase()}`}
                            >
                              {stayStatusLabel(
                                stay.status,
                              )}
                            </span>

                            {stay.actualCheckIn && (
                              <div className="guest-tertiary">
                                Real:{' '}
                                {formatDate(
                                  stay.actualCheckIn,
                                )}
                              </div>
                            )}
                          </td>

                          <td className="guest-date-cell">
                            <strong>
                              {formatShortDate(
                                stay.checkIn,
                              )}
                            </strong>

                            <small>
                              {HOTEL_CHECK_IN_TIME}
                            </small>
                          </td>

                          <td className="guest-date-cell">
                            <strong>
                              {formatShortDate(
                                stay.checkOut,
                              )}
                            </strong>

                            <small>
                              {HOTEL_CHECK_OUT_TIME}
                            </small>
                          </td>

                          <td>
                            {renderWifiActions(
                              guest,
                              stay,
                            )}
                          </td>

                          <td>
                            {renderStayActions(
                              guest,
                              stay,
                            )}
                          </td>
                        </tr>
                      )
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {qrWifi?.wifi.accessUrl && (
        <div
          className="guest-qr-backdrop"
          onClick={() =>
            setQrWifi(null)
          }
        >
          <div
            className="guest-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Acceso WiFi habitación ${qrWifi.roomNumber}`}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="guest-qr-head">
              <span>
                ACCESO WIFI
              </span>

              <strong>
                Habitación {qrWifi.roomNumber}
              </strong>

              <p>
                {qrWifi.guestName}
              </p>
            </div>

            <div className="guest-qr-body">
              <div className="guest-qr-code">
                <QRCodeSVG
                  value={
                    qrWifi.wifi.accessUrl
                  }
                  size={220}
                  level="M"
                />
              </div>

              <div className="guest-qr-info-grid">
                <div>
                  <span>
                    Usuario
                  </span>

                  <strong>
                    {qrWifi.wifi.username ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>
                    Contraseña
                  </span>

                  <strong>
                    {qrWifi.wifi.password ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>
                    Dispositivos
                  </span>

                  <strong>
                    Hasta {qrWifi.maxDevices}
                  </strong>
                </div>
              </div>

              <div className="guest-qr-expiry">
                Expira{' '}
                <strong>
                  {formatDate(
                    qrWifi.wifi.expiresAt,
                  )}
                </strong>
              </div>

              <p className="guest-qr-help">
                Escanea el código para consultar
                las credenciales de acceso.
              </p>

              <p className="guest-qr-timeout">
                Se cerrará automáticamente en 60 segundos.
              </p>

              <div className="guest-qr-actions">
                <button
                  type="button"
                  onClick={() =>
                    window.print()
                  }
                  className="guest-btn guest-btn-secondary guest-qr-print"
                >
                  Imprimir acceso
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setQrWifi(null)
                  }
                  className="guest-btn guest-btn-primary guest-qr-close"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
