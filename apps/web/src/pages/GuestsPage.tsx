import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../api/client'

const HOTEL_CHECK_IN_TIME = '14:00'
const HOTEL_CHECK_OUT_TIME = '12:00'

const SITE_ID = '735423b5-d7f2-4ac4-81a7-e4c1aa989538'

type WifiAccess = {
  id: string
  stayId: string
  username: string | null
  password: string | null
  accessUrl: string | null
  token: string
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'DISABLED'
  activatedAt: string | null
  expiresAt: string
  deactivatedAt: string | null
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

export default function GuestsPage() {
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

  const [actionId, setActionId] = useState<string | null>(null)

  async function loadGuests() {
    try {
      setLoading(true)
      setError('')

      const response = await apiFetch(
        `/guests?siteId=${SITE_ID}`,
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        throw new Error(
          data?.error ||
            'No se pudieron cargar los huéspedes',
        )
      }

      const data = await response.json()

      setGuests(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los huéspedes',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadRooms() {
    try {
      setLoadingRooms(true)

      const response = await apiFetch(
        `/rooms?siteId=${SITE_ID}`,
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        throw new Error(
          data?.error ||
            'No se pudieron cargar las habitaciones',
        )
      }

      const data = await response.json()

      setRooms(Array.isArray(data) ? data : [])
    } catch (err) {
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
    void loadGuests()
  }, [])

  function resetReservationForm() {
    setName('')
    setEmail('')
    setPhone('')
    setRoomId('')
    setCheckIn('')
    setCheckOut('')
    setNotes('')
  }
function buildHotelDateTime(
  date: string,
  time: string,
) {
  return new Date(`${date}T${time}:00`)
}

  function openReservationForm() {
    setError('')
    resetReservationForm()
    setShowReservationForm(true)
    void loadRooms()
  }

  function closeReservationForm() {
    if (creatingReservation) {
      return
    }

    setShowReservationForm(false)
    resetReservationForm()
    setError('')
  }

  /*
   * Calcula las habitaciones disponibles según
   * las fechas seleccionadas.
   *
   * Una habitación NO está disponible si tiene
   * una estancia RESERVED o CHECKED_IN que se
   * traslape con el periodo solicitado.
   *
   * CHECKED_OUT y CANCELLED no bloquean.
   */

const availableRooms = useMemo(() => {
  if (!checkIn || !checkOut) {
    return []
  }

  const requestedStart = buildHotelDateTime(
    checkIn,
    HOTEL_CHECK_IN_TIME,
  )

  const requestedEnd = buildHotelDateTime(
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
    const hasConflict = guests.some((guest) =>
      guest.stays.some((stay) => {
        if (
          stay.roomId !== room.id ||
          (stay.status !== 'RESERVED' &&
            stay.status !== 'CHECKED_IN')
        ) {
          return false
        }

        const existingStart = new Date(stay.checkIn)
        const existingEnd = new Date(stay.checkOut)

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
}, [rooms, guests, checkIn, checkOut])  

  /*
   * Si la habitación seleccionada deja de estar
   * disponible al cambiar las fechas, se limpia
   * automáticamente.
   */
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

    if (!name.trim()) {
      setError('El nombre del huésped es obligatorio')
      return
    }

    if (!checkIn) {
      setError('La fecha y hora de entrada son obligatorias')
      return
    }

    if (!checkOut) {
      setError('La fecha y hora de salida son obligatorias')
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

    /*
     * Segunda protección en frontend:
     * comprobar nuevamente que la habitación seleccionada
     * siga disponible antes de enviar la reserva.
     */
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
            siteId: SITE_ID,
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            roomId,
            checkIn: start.toISOString(),
            checkOut: end.toISOString(),
            notes: notes.trim() || null,
          }),
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudo crear la reserva',
        )
      }

      setShowReservationForm(false)
      resetReservationForm()

      await loadGuests()
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
    try {
      setActionId(id)
      setError('')

      const response = await apiFetch(action, {
        method: 'POST',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudo ejecutar la operación',
        )
      }

      await loadGuests()
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

  function getCurrentStay(guest: Guest) {
    const activeStay = guest.stays.find(
      (stay) =>
        stay.status === 'CHECKED_IN' ||
        stay.status === 'RESERVED',
    )

    if (activeStay) {
      return activeStay
    }

    return [...guest.stays].sort(
      (a, b) =>
        new Date(b.checkOut).getTime() -
        new Date(a.checkOut).getTime(),
    )[0]
  }

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
      <div className="flex flex-wrap gap-2">
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
              className="rounded-lg bg-black px-3 py-2 text-xs text-white disabled:opacity-50"
            >
              {actionId ===
              `${busyPrefix}checkin`
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
              className="rounded-lg border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              {actionId ===
              `${busyPrefix}cancel`
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
            className="rounded-lg bg-black px-3 py-2 text-xs text-white disabled:opacity-50"
          >
            {actionId ===
            `${busyPrefix}checkout`
              ? 'Registrando...'
              : 'Check-out'}
          </button>
        )}

        {stay.status === 'CHECKED_OUT' && (
          <span className="text-xs text-gray-500">
            Estancia finalizada
          </span>
        )}

        {stay.status === 'CANCELLED' && (
          <span className="text-xs text-gray-500">
            Estancia cancelada
          </span>
        )}
      </div>
    )
  }

  function renderWifiActions(
    guest: Guest,
    stay: Stay,
  ) {
    /*
     * El acceso WiFi pertenece al CHECK-IN.
     * No mostramos acciones WiFi para una reserva
     * que todavía no ha recibido al huésped.
     */
    if (stay.status === 'RESERVED') {
      return (
        <span className="text-xs text-gray-500">
          Se habilita al hacer check-in
        </span>
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
          className="rounded-lg border px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          {actionId === id
            ? 'Creando...'
            : 'Crear acceso WiFi'}
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
          className="rounded-lg bg-black px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          {actionId === id
            ? 'Activando...'
            : 'Activar WiFi'}
        </button>
      )
    }

    if (wifi.status === 'ACTIVE') {
      return (
        <div>
          <div className="font-medium">
            Acceso activo
          </div>

          {wifi.username && (
            <div className="text-xs text-gray-500">
              Usuario: {wifi.username}
            </div>
          )}

          {wifi.expiresAt && (
            <div className="text-xs text-gray-500">
              Expira:{' '}
              {formatDate(
                wifi.expiresAt,
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="text-xs text-gray-500">
        {wifiStatusLabel(wifi.status)}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Huéspedes
          </h1>

          <p className="text-sm text-gray-500">
            Gestión de huéspedes, reservas,
            estancias y acceso WiFi.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void loadGuests()
            }
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Actualizar
          </button>

          <button
            type="button"
            onClick={openReservationForm}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Nueva reserva
          </button>
        </div>
      </div>

      {/* CREATE RESERVATION FORM */}
      {showReservationForm && (
        <div className="rounded-xl border bg-white p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              Nueva reserva
            </h2>

            <p className="text-sm text-gray-500">
              Registra al huésped y su estancia
              en una sola operación.
            </p>
          </div>

          <form
            onSubmit={handleCreateReservation}
            className="space-y-4"
          >
            {/* GUEST DATA */}
            <div>
              <div className="mb-3 text-sm font-medium">
                Datos del huésped
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Nombre *
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="Nombre del huésped"
                    autoFocus
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Teléfono
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="222 000 0000"
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
                  />
                </div>
              </div>
            </div>

            {/* STAY DATA */}
            <div className="border-t pt-4">
              <div className="mb-3 text-sm font-medium">
                Datos de la estancia
              </div>

              <div className="grid gap-4 md:grid-cols-3">

                {/* ENTRY DATE */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Entrada *
                  </label>

                  <input
                    type="date"
                    value={checkIn}
                    onChange={(event) => {
                      setCheckIn(
                        event.target.value
                      )
                    }}
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
                  />
<p className="mt-1 text-xs text-gray-500">
  Check-in del hotel: {HOTEL_CHECK_IN_TIME}
</p>
                </div>

                {/* EXIT DATE */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Salida *
                  </label>

                <input
  type="date"
  value={checkOut}
  onChange={(event) => {
    setCheckOut(event.target.value)
  }}
  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
/>

<p className="mt-1 text-xs text-gray-500">
  Check-out del hotel: {HOTEL_CHECK_OUT_TIME}
</p> 

                </div>

                {/* ROOM */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
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
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    <option value="">
                      {loadingRooms
                        ? 'Cargando habitaciones...'
                        : !checkIn ||
                            !checkOut
                          ? 'Primero selecciona las fechas'
                          : availableRooms.length ===
                              0
                            ? 'No hay habitaciones disponibles'
                            : 'Seleccionar habitación'}
                    </option>

                    {availableRooms.map((room) => (
                      <option
                        key={room.id}
                        value={room.id}
                      >
                        Hab. {room.number}
                        {room.floor !== null
                          ? ` — Piso ${room.floor}`
                          : ''}
                      </option>
                    ))}
                  </select>

                  {!checkIn ||
                  !checkOut ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Selecciona primero la entrada y
                      salida para consultar disponibilidad.
                    </p>
                  ) : availableRooms.length > 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {availableRooms.length}{' '}
                      {availableRooms.length === 1
                        ? 'habitación disponible'
                        : 'habitaciones disponibles'}{' '}
                      para estas fechas.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-red-600">
                      No hay habitaciones disponibles para
                      el periodo seleccionado.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Notas
              </label>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Notas de la estancia"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2"
              />
            </div>

            {/* BUTTONS */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeReservationForm}
                disabled={creatingReservation}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
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
                className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingReservation
                  ? 'Guardando...'
                  : 'Crear reserva'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          Cargando huéspedes...
        </div>
      )}

      {/* EMPTY */}
      {!loading &&
        !error &&
        guests.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center">
            <div className="text-lg font-medium">
              No hay huéspedes
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Las reservas registradas
              aparecerán aquí.
            </p>
          </div>
        )}

      {/* TABLE */}
      {!loading &&
        guests.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Huésped
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Contacto
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Habitación
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Estancia
                    </th>

                    <th className="px-4 py-3 font-medium">
                      WiFi
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {guests.map((guest) => {
                    const stay =
                      getCurrentStay(guest)

                    return (
                      <tr
                        key={guest.id}
                        className="hover:bg-gray-50"
                      >
                        {/* GUEST */}
                        <td className="px-4 py-4">
                          <div className="font-medium">
                            {guest.name}
                          </div>

                          <div className="text-xs text-gray-500">
                            ID:{' '}
                            {guest.id.slice(
                              0,
                              8,
                            )}
                          </div>
                        </td>

                        {/* CONTACT */}
                        <td className="px-4 py-4">
                          <div>
                            {guest.email ||
                              '—'}
                          </div>

                          <div className="text-gray-500">
                            {guest.phone ||
                              '—'}
                          </div>
                        </td>

                        {/* ROOM */}
                        <td className="px-4 py-4">
                          {stay ? (
                            <>
                              <div className="font-medium">
                                Hab.{' '}
                                {stay.room.number}
                              </div>

                              <div className="text-xs text-gray-500">
                                Piso{' '}
                                {stay.room
                                  .floor ??
                                  '—'}
                              </div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* STAY */}
                        <td className="px-4 py-4">
                          {stay ? (
                            <>
                              <div>
                                {stay.status}
                              </div>

                              <div className="text-xs text-gray-500">
                                {formatDate(
                                  stay.checkIn,
                                )}
                                {' → '}
                                {formatDate(
                                  stay.checkOut,
                                )}
                              </div>

                              {stay.actualCheckIn && (
                                <div className="text-xs text-gray-500">
                                  Entrada real:{' '}
                                  {formatDate(
                                    stay.actualCheckIn,
                                  )}
                                </div>
                              )}

                              {stay.actualCheckOut && (
                                <div className="text-xs text-gray-500">
                                  Salida real:{' '}
                                  {formatDate(
                                    stay.actualCheckOut,
                                  )}
                                </div>
                              )}

                              {stay.notes && (
                                <div className="mt-1 text-xs text-gray-500">
                                  Nota:{' '}
                                  {stay.notes}
                                </div>
                              )}
                            </>
                          ) : (
                            'Sin estancia'
                          )}
                        </td>

                        {/* WIFI */}
                        <td className="px-4 py-4">
                          {stay ? (
                            renderWifiActions(
                              guest,
                              stay,
                            )
                          ) : (
                            <span className="text-gray-500">
                              Sin estancia
                            </span>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td className="px-4 py-4">
                          {stay ? (
                            renderStayActions(
                              guest,
                              stay,
                            )
                          ) : (
                            <span className="text-xs text-gray-500">
                              Sin estancia
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  )
}
