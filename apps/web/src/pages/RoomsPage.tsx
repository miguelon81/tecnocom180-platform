import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { getSites } from '../api/sites'
import type { Site, RoomStatus } from '../types/site'
import { apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type Area = {
  id: string
  siteId: string
  name: string
  type: string | null
}

type Room = {
  id: string
  siteId: string
  areaId: string | null
  number: string
  floor: number | null
  status: RoomStatus
  site?: {
    id: string
    name: string
  }
  area?: Area | null
}

type RoomForm = {
  siteId: string
  areaId: string
  number: string
  floor: string
  status: RoomStatus
}

const emptyForm: RoomForm = {
  siteId: '',
  areaId: '',
  number: '',
  floor: '',
  status: 'AVAILABLE',
}

const statusLabels: Record<RoomStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  MAINTENANCE: 'Mantenimiento',
  CLEANING: 'Limpieza',
}

async function parseError(response: Response): Promise<string> {
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

async function getRooms(siteId?: string): Promise<Room[]> {
  const query = siteId
    ? `?siteId=${encodeURIComponent(siteId)}`
    : ''

  const response = await apiFetch(`/rooms${query}`)

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data) ? data : []
}

async function createRoom(
  data: {
    siteId: string
    areaId?: string | null
    number: string
    floor?: number | null
    status?: RoomStatus
  },
): Promise<Room> {
  const response = await apiFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

async function updateRoom(
  id: string,
  data: {
    number?: string
    areaId?: string | null
    floor?: number | null
    status?: RoomStatus
  },
): Promise<Room> {
  const response = await apiFetch(`/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json()
}

async function deleteRoom(id: string): Promise<void> {
  const response = await apiFetch(`/rooms/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}

async function getAreas(siteId: string): Promise<Area[]> {
  const response = await apiFetch(
    `/areas?siteId=${encodeURIComponent(siteId)}`,
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const data = await response.json()

  return Array.isArray(data) ? data : []
}

function RoomsPage() {

  const { user } = useAuth()

  const canManageRooms =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ORG_ADMIN'

  const [rooms, setRooms] = useState<Room[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [areas, setAreas] = useState<Area[]>([])

  const [selectedSiteId, setSelectedSiteId] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  const [form, setForm] = useState<RoomForm>(emptyForm)

  
  

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true)
        setError(null)

        const siteData = await getSites()

        setSites(siteData)

        if (siteData.length === 0) {
          setRooms([])
          setAreas([])
          return
        }

        const firstSiteId =
          selectedSiteId || siteData[0].id

        setSelectedSiteId(firstSiteId)

        const [roomData, areaData] = await Promise.all([
          getRooms(firstSiteId),
          getAreas(firstSiteId),
        ])

        setRooms(roomData)
        setAreas(areaData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error al cargar las habitaciones',
        )
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!selectedSiteId) {
      return
    }

    async function loadSiteData() {
      try {
        setLoading(true)
        setError(null)

        const [roomData, areaData] = await Promise.all([
          getRooms(selectedSiteId),
          getAreas(selectedSiteId),
        ])

        setRooms(roomData)
        setAreas(areaData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error al cargar los datos del sitio',
        )
      } finally {
        setLoading(false)
      }
    }

    loadSiteData()
  }, [selectedSiteId])

  function openCreateForm() {
    setEditingRoom(null)

    setForm({
      ...emptyForm,
      siteId: selectedSiteId,
    })

    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(room: Room) {
    setEditingRoom(room)

    setForm({
      siteId: room.siteId,
      areaId: room.areaId ?? '',
      number: room.number,
      floor:
        room.floor !== null && room.floor !== undefined
          ? String(room.floor)
          : '',
      status: room.status,
    })

    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingRoom(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function handleChange(
    field: keyof RoomForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.siteId) {
      setFormError('El sitio es obligatorio')
      return
    }

    if (!form.number.trim()) {
      setFormError(
        'El número de habitación es obligatorio',
      )
      return
    }

    let floor: number | null = null

    if (form.floor.trim()) {
      const parsedFloor = Number(form.floor)

      if (
        !Number.isInteger(parsedFloor) ||
        parsedFloor < 0
      ) {
        setFormError(
          'El piso debe ser un número entero válido',
        )
        return
      }

      floor = parsedFloor
    }

    try {
      setSaving(true)
      setFormError(null)

      if (editingRoom) {
        const updatedRoom = await updateRoom(
          editingRoom.id,
          {
            number: form.number.trim(),
            areaId: form.areaId || null,
            floor,
            status: form.status,
          },
        )

        setRooms((current) =>
          current
            .map((room) =>
              room.id === updatedRoom.id
                ? updatedRoom
                : room,
            )
            .sort((a, b) =>
              a.number.localeCompare(
                b.number,
                undefined,
                { numeric: true },
              ),
            ),
        )
      } else {
        const createdRoom = await createRoom({
          siteId: form.siteId,
          areaId: form.areaId || null,
          number: form.number.trim(),
          floor,
          status: form.status,
        })

        setRooms((current) =>
          [...current, createdRoom].sort((a, b) =>
            a.number.localeCompare(
              b.number,
              undefined,
              { numeric: true },
            ),
          ),
        )
      }

      closeForm()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar la habitación',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(room: Room) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la habitación "${room.number}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await deleteRoom(room.id)

      setRooms((current) =>
        current.filter(
          (item) => item.id !== room.id,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al eliminar la habitación',
      )
    }
  }

  async function handleStatusChange(
    room: Room,
    status: RoomStatus,
  ) {
    try {
      setError(null)

      const updatedRoom = await updateRoom(
        room.id,
        { status },
      )

      setRooms((current) =>
        current.map((item) =>
          item.id === updatedRoom.id
            ? updatedRoom
            : item,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cambiar el estado',
      )
    }
  }

  const selectedSite = sites.find(
    (site) => site.id === selectedSiteId,
  )

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>Habitaciones</h1>

          <p className="subtitle">
            Gestión de habitaciones dentro de cada sitio.
          </p>
        </div>

        <div className="site-count">
          {rooms.length}{' '}
          {rooms.length === 1
            ? 'habitación'
            : 'habitaciones'}
        </div>
      </header>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #dc2626',
          }}
        >
          {error}
        </div>
      )}

      {sites.length === 0 && !loading && (
        <section className="card">
          <h2>No hay sitios registrados</h2>

          <p>
            Primero debes registrar un sitio para poder
            crear habitaciones.
          </p>
        </section>
      )}

      {sites.length > 0 && (
        <>
          <section
            style={{
              marginBottom: '24px',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #d1d5db',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <label>
              Sitio

              <select
                value={selectedSiteId}
                onChange={(event) =>
                  setSelectedSiteId(
                    event.target.value,
                  )
                }
              >
                {sites.map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

{canManageRooms && (
  <button
    type="button"
    onClick={openCreateForm}
  >
    + Nueva habitación
  </button>
)}           

          </section>

          {canManageRooms && showForm && (
            <section
              style={{
                marginBottom: '24px',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #d1d5db',
              }}
            >
              <p className="eyebrow">
                {editingRoom
                  ? 'EDITAR HABITACIÓN'
                  : 'NUEVA HABITACIÓN'}
              </p>

              <h2>
                {editingRoom
                  ? `Habitación ${editingRoom.number}`
                  : 'Registrar habitación'}
              </h2>

              {formError && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #dc2626',
                  }}
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <label>
                    Sitio

                    <select
                      value={form.siteId}
                      disabled={!!editingRoom}
                      onChange={(event) =>
                        handleChange(
                          'siteId',
                          event.target.value,
                        )
                      }
                    >
                      {sites.map((site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Área

                    <select
                      value={form.areaId}
                      onChange={(event) =>
                        handleChange(
                          'areaId',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Sin área
                      </option>

                      {areas
                        .filter(
                          (area) =>
                            area.siteId ===
                            form.siteId,
                        )
                        .map((area) => (
                          <option
                            key={area.id}
                            value={area.id}
                          >
                            {area.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Número

                    <input
                      type="text"
                      value={form.number}
                      onChange={(event) =>
                        handleChange(
                          'number',
                          event.target.value,
                        )
                      }
                      placeholder="101"
                    />
                  </label>

                  <label>
                    Piso

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.floor}
                      onChange={(event) =>
                        handleChange(
                          'floor',
                          event.target.value,
                        )
                      }
                      placeholder="1"
                    />
                  </label>

                  <label>
                    Estado

                    <select
                      value={form.status}
                      onChange={(event) =>
                        handleChange(
                          'status',
                          event.target.value,
                        )
                      }
                    >
                      <option value="AVAILABLE">
                        Disponible
                      </option>

                      <option value="OCCUPIED">
                        Ocupada
                      </option>

                      <option value="MAINTENANCE">
                        Mantenimiento
                      </option>

                      <option value="CLEANING">
                        Limpieza
                      </option>
                    </select>
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '20px',
                  }}
                >
                  <button
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? 'Guardando...'
                      : editingRoom
                        ? 'Guardar cambios'
                        : 'Crear habitación'}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeForm}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          {loading ? (
            <p>Cargando habitaciones...</p>
          ) : rooms.length === 0 ? (
            <section className="card">
              <h2>
                No hay habitaciones registradas
              </h2>

              <p>
                {selectedSite
                  ? `El sitio "${selectedSite.name}" todavía no tiene habitaciones.`
                  : 'Selecciona un sitio.'}
              </p>
            </section>
          ) : (
            <section className="sites-grid">
              {rooms.map((room) => (
                <article
                  className="site-card"
                  key={room.id}
                >
                  <div className="site-card-header">
                    <div>
                      <p className="site-code">
                        {room.site?.name ??
                          selectedSite?.name ??
                          'SITIO'}
                      </p>

                      <h2>
                        Habitación {room.number}
                      </h2>
                    </div>

                    <span className="status status-active">
                      {statusLabels[room.status]}
                    </span>
                  </div>

                  <p className="site-location">
                    {room.area?.name ??
                      'Sin área'}
                    {' · '}
                    Piso {room.floor ?? '—'}
                  </p>

                  {canManageRooms && (
  <div
    style={{
      display: 'flex',
      gap: '8px',
      marginTop: '18px',
      flexWrap: 'wrap',
    }}
  >
    <button
      type="button"
      onClick={() =>
        openEditForm(room)
      }
    >
      Editar
    </button>

    <select
      value={room.status}
      onChange={(event) =>
        handleStatusChange(
          room,
          event.target.value as RoomStatus,
        )
      }
    >
      <option value="AVAILABLE">
        Disponible
      </option>

      <option value="OCCUPIED">
        Ocupada
      </option>

      <option value="MAINTENANCE">
        Mantenimiento
      </option>

      <option value="CLEANING">
        Limpieza
      </option>
    </select>

    <button
      type="button"
      onClick={() =>
        handleDelete(room)
      }
    >
      Eliminar
    </button>
  </div>
)}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default RoomsPage