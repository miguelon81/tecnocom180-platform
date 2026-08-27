import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api/client'

type Ticket = {
  id: string
  title?: string | null
  description?: string | null
  status?: string | null
  type?: string | null
  source?: string | null
  createdAt?: string
  room?: {
    id?: string
    number: string
  } | null
  device?: {
    hostname?: string | null
  } | null
  site?: {
    id?: string
    name: string
  } | null
  area?: {
    id?: string
    name: string
  } | null
}

type Site = {
  id: string
  name: string
}

type Area = {
  id: string
  name: string
  siteId?: string
  site?: {
    id: string
  } | null
}

type Room = {
  id: string
  number: string
  siteId?: string
  site?: {
    id: string
  } | null
}

const statusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
}

const typeLabels: Record<string, string> = {
  WIFI: 'WiFi',
  INTERNET: 'Internet',
  TV: 'TV',
  CAMERA: 'Cámara',
  NETWORK: 'Red',
  OTHER: 'Otro',
}

function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showNewTicket, setShowNewTicket] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [form, setForm] = useState({
    siteId: '',
    areaId: '',
    roomId: '',
    type: 'WIFI',
    title: '',
    description: '',
  })

  async function loadTickets() {
    try {
      setLoading(true)
      setError('')

      const response = await apiFetch('/tickets')

      if (!response.ok) {
        throw new Error('No se pudieron cargar los tickets')
      }

      const data = await response.json()

      setTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los tickets',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadFormData() {
    try {
      const [sitesResponse, areasResponse, roomsResponse] =
        await Promise.all([
          apiFetch('/sites'),
          apiFetch('/areas'),
          apiFetch('/rooms'),
        ])

      if (sitesResponse.ok) {
        const data = await sitesResponse.json()
        setSites(Array.isArray(data) ? data : [])
      }

      if (areasResponse.ok) {
        const data = await areasResponse.json()
        setAreas(Array.isArray(data) ? data : [])
      }

      if (roomsResponse.ok) {
        const data = await roomsResponse.json()
        setRooms(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error cargando datos del formulario:', err)
    }
  }

  useEffect(() => {
    loadTickets()
    loadFormData()
  }, [])

  const filteredAreas = useMemo(() => {
    if (!form.siteId) {
      return areas
    }

    return areas.filter(
      (area) =>
        area.siteId === form.siteId ||
        area.site?.id === form.siteId,
    )
  }, [areas, form.siteId])

  const filteredRooms = useMemo(() => {
    if (!form.siteId) {
      return rooms
    }

    return rooms.filter(
      (room) =>
        room.siteId === form.siteId ||
        room.site?.id === form.siteId,
    )
  }, [rooms, form.siteId])

  function resetForm() {
    setForm({
      siteId: '',
      areaId: '',
      roomId: '',
      type: 'WIFI',
      title: '',
      description: '',
    })

    setSaveError('')
    setSaveSuccess('')
  }

  function closeNewTicket() {
    if (saving) {
      return
    }

    setShowNewTicket(false)
    resetForm()
  }

  async function createTicket() {
    setSaveError('')
    setSaveSuccess('')

    if (!form.siteId) {
      setSaveError('Selecciona un sitio.')
      return
    }

    if (!form.type) {
      setSaveError('Selecciona el tipo de incidencia.')
      return
    }

    if (!form.title.trim()) {
      setSaveError('Escribe el problema o título del ticket.')
      return
    }

    try {
      setSaving(true)

      const storedUser = localStorage.getItem(
        'tecnocom180_user',
      )

      if (!storedUser) {
        throw new Error(
          'No se encontró la sesión del usuario.',
        )
      }

      const user = JSON.parse(storedUser)

      const organizationId =
        user.organizationId

      if (!organizationId) {
        throw new Error(
          'El usuario no tiene una organización asignada.',
        )
      }

      const response = await apiFetch('/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          siteId: form.siteId,
          areaId: form.areaId || null,
          roomId: form.roomId || null,
          type: form.type,
          source: 'MANUAL',
          title: form.title.trim(),
          description:
            form.description.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'No se pudo crear el ticket.',
        )
      }

      setTickets((current) => [
        data,
        ...current,
      ])

      setSaveSuccess(
        'Ticket creado correctamente.',
      )

      setForm({
        siteId: '',
        areaId: '',
        roomId: '',
        type: 'WIFI',
        title: '',
        description: '',
      })

      setTimeout(() => {
        setShowNewTicket(false)
        setSaveSuccess('')
      }, 900)
    } catch (err) {
      console.error(err)

      setSaveError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear el ticket.',
      )
    } finally {
      setSaving(false)
    }
  }

  const statistics = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter(
        (ticket) => ticket.status === 'OPEN',
      ).length,
      pending: tickets.filter(
        (ticket) => ticket.status === 'PENDING',
      ).length,
      inProgress: tickets.filter(
        (ticket) => ticket.status === 'IN_PROGRESS',
      ).length,
      resolved: tickets.filter(
        (ticket) =>
          ticket.status === 'RESOLVED' ||
          ticket.status === 'CLOSED',
      ).length,
    }
  }, [tickets])

  const ticketsByDay = useMemo(() => {
    function localDateKey(date: Date) {
      const year = date.getFullYear()

      const month = String(
        date.getMonth() + 1,
      ).padStart(2, '0')

      const day = String(
        date.getDate(),
      ).padStart(2, '0')

      return `${year}-${month}-${day}`
    }

    const days = new Map<string, number>()

    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)

      date.setHours(0, 0, 0, 0)

      date.setDate(
        today.getDate() - i,
      )

      const key = localDateKey(date)

      days.set(key, 0)
    }

    tickets.forEach((ticket) => {
      if (!ticket.createdAt) {
        return
      }

      const date = new Date(
        ticket.createdAt,
      )

      if (Number.isNaN(date.getTime())) {
        return
      }

      const key = localDateKey(date)

      if (days.has(key)) {
        days.set(
          key,
          (days.get(key) ?? 0) + 1,
        )
      }
    })

    return Array.from(days.entries()).map(
      ([date, count]) => ({
        date,
        count,
        label: new Date(
          `${date}T12:00:00`,
        ).toLocaleDateString(
          'es-MX',
          {
            weekday: 'short',
            day: 'numeric',
          },
        ),
      }),
    )
  }, [tickets])

  const maxTicketsPerDay = Math.max(
    ...ticketsByDay.map(
      (item) => item.count,
    ),
    1,
  )

  const ticketsByArea = useMemo(() => {
    const counts = new Map<string, number>()

    tickets.forEach((ticket) => {
      const area =
        ticket.area?.name ?? 'Sin área'

      counts.set(
        area,
        (counts.get(area) ?? 0) + 1,
      )
    })

    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort(
        (a, b) => b.count - a.count,
      )
  }, [tickets])

  const maxTicketsPerArea = Math.max(
    ...ticketsByArea.map(
      (item) => item.count,
    ),
    1,
  )

  const ticketsByType = useMemo(() => {
    const counts = new Map<string, number>()

    tickets.forEach((ticket) => {
      const type =
        ticket.type ?? 'OTHER'

      counts.set(
        type,
        (counts.get(type) ?? 0) + 1,
      )
    })

    return Array.from(counts.entries())
      .map(([type, count]) => ({
        type,
        label:
          typeLabels[type] ?? type,
        count,
      }))
      .sort(
        (a, b) => b.count - a.count,
      )
  }, [tickets])

  const maxTicketsPerType = Math.max(
    ...ticketsByType.map(
      (item) => item.count,
    ),
    1,
  )

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>Tickets</h1>

          <p className="subtitle">
            Gestión y análisis de incidencias.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div className="site-count">
            {tickets.length}{' '}
            {tickets.length === 1
              ? 'ticket'
              : 'tickets'}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowNewTicket(true)
              setSaveError('')
              setSaveSuccess('')
            }}
            style={{
              padding:
                '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background:
                '#2563eb',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Nuevo ticket
          </button>
        </div>
      </header>

      {showNewTicket && (
        <section
          className="card"
          style={{
            marginBottom: '24px',
            border:
              '1px solid #bfdbfe',
          }}
        >
          <div
            className="page-header"
          >
            <div>
              <p className="eyebrow">
                CAPTURA MANUAL
              </p>

              <h2>
                Nuevo ticket
              </h2>

              <p>
                Registra una incidencia desde
                recepción.
              </p>
            </div>

            <button
              type="button"
              onClick={closeNewTicket}
              disabled={saving}
              style={{
                padding:
                  '8px 14px',
                borderRadius: '8px',
                border:
                  '1px solid #d1d5db',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>

          {saveError && (
            <div
              className="error-message"
              style={{
                marginBottom: '16px',
              }}
            >
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div
              style={{
                padding: '12px 16px',
                marginBottom: '16px',
                borderRadius: '8px',
                background:
                  '#dcfce7',
                color: '#166534',
              }}
            >
              {saveSuccess}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            <label>
              <strong>Sitio *</strong>

              <select
                value={form.siteId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    siteId:
                      event.target.value,
                    areaId: '',
                    roomId: '',
                  }))
                }}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    '1px solid #d1d5db',
                }}
              >
                <option value="">
                  Seleccionar sitio
                </option>

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
              <strong>Área</strong>

              <select
                value={form.areaId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    areaId:
                      event.target.value,
                  }))
                }}
                disabled={!form.siteId}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    '1px solid #d1d5db',
                }}
              >
                <option value="">
                  Sin área
                </option>

                {filteredAreas.map(
                  (area) => (
                    <option
                      key={area.id}
                      value={area.id}
                    >
                      {area.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <strong>
                Habitación
              </strong>

              <select
                value={form.roomId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    roomId:
                      event.target.value,
                  }))
                }}
                disabled={!form.siteId}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    '1px solid #d1d5db',
                }}
              >
                <option value="">
                  Sin habitación
                </option>

                {filteredRooms.map(
                  (room) => (
                    <option
                      key={room.id}
                      value={room.id}
                    >
                      Habitación {room.number}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <strong>Tipo *</strong>

              <select
                value={form.type}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    type:
                      event.target.value,
                  }))
                }}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    '1px solid #d1d5db',
                }}
              >
                <option value="WIFI">
                  WiFi
                </option>

                <option value="INTERNET">
                  Internet
                </option>

                <option value="TV">
                  TV
                </option>

                <option value="CAMERA">
                  Cámara
                </option>

                <option value="NETWORK">
                  Red
                </option>

                <option value="OTHER">
                  Otro
                </option>
              </select>
            </label>

            <label
              style={{
                gridColumn:
                  '1 / -1',
              }}
            >
              <strong>
                Problema / título *
              </strong>

              <input
                type="text"
                value={form.title}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    title:
                      event.target.value,
                  }))
                }}
                placeholder="Ej. Huésped sin Internet"
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    '1px solid #d1d5db',
                  boxSizing:
                    'border-box',
                }}
              />
            </label>

            <label
              style={{
                gridColumn:
                  '1 / -1',
              }}
            >
              <strong>
                Descripción
              </strong>

              <textarea
                value={
                  form.description
                }
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }}
                placeholder="Describe brevemente la incidencia..."
                rows={4}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border:
                    '1px solid #d1d5db',
                  resize: 'vertical',
                  boxSizing:
                    'border-box',
                }}
              />
            </label>
          </div>

          <div
            style={{
              marginTop: '20px',
              padding: '12px 16px',
              borderRadius: '8px',
              background:
                '#f3f4f6',
              fontSize: '14px',
            }}
          >
            <strong>
              Fuente:
            </strong>{' '}
            Manual — recepción
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent:
                'flex-end',
              gap: '12px',
              marginTop: '20px',
            }}
          >
            <button
              type="button"
              onClick={closeNewTicket}
              disabled={saving}
              style={{
                padding:
                  '10px 18px',
                borderRadius: '8px',
                border:
                  '1px solid #d1d5db',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={createTicket}
              disabled={saving}
              style={{
                padding:
                  '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background:
                  '#2563eb',
                color: 'white',
                fontWeight: 600,
                cursor: saving
                  ? 'wait'
                  : 'pointer',
              }}
            >
              {saving
                ? 'Guardando...'
                : 'Crear ticket'}
            </button>
          </div>
        </section>
      )}

      {loading && (
        <section className="card">
          <p>Cargando tickets...</p>
        </section>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* =====================================================
              INDICADORES
          ===================================================== */}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <article className="card">
              <p className="eyebrow">
                TOTAL
              </p>
              <h2>
                {statistics.total}
              </h2>
              <p>
                Tickets registrados
              </p>
            </article>

            <article className="card">
              <p className="eyebrow">
                ABIERTOS
              </p>
              <h2>
                {statistics.open}
              </h2>
              <p>
                Requieren atención
              </p>
            </article>

            <article className="card">
              <p className="eyebrow">
                PENDIENTES
              </p>
              <h2>
                {statistics.pending}
              </h2>
              <p>
                En espera
              </p>
            </article>

            <article className="card">
              <p className="eyebrow">
                EN PROCESO
              </p>
              <h2>
                {statistics.inProgress}
              </h2>
              <p>
                Atendidos actualmente
              </p>
            </article>

            <article className="card">
              <p className="eyebrow">
                RESUELTOS
              </p>
              <h2>
                {statistics.resolved}
              </h2>
              <p>
                Resueltos o cerrados
              </p>
            </article>
          </section>

          {/* =====================================================
              HISTOGRAMA
          ===================================================== */}

          <section
            className="card"
            style={{
              marginBottom: '24px',
            }}
          >
            <div className="page-header">
              <div>
                <p className="eyebrow">
                  TENDENCIA
                </p>

                <h2>
                  Tickets en los últimos
                  7 días
                </h2>

                <p>
                  Cantidad de incidencias
                  registradas por día.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'end',
                gap: '16px',
                height: '260px',
                padding:
                  '20px 10px 0',
                borderBottom:
                  '1px solid #d1d5db',
              }}
            >
              {ticketsByDay.map(
                (item) => {
                  const height =
                    item.count === 0
                      ? 4
                      : Math.max(
                          10,
                          (item.count /
                            maxTicketsPerDay) *
                            210,
                        )

                  return (
                    <div
                      key={item.date}
                      style={{
                        flex: 1,
                        height: '100%',
                        display: 'flex',
                        flexDirection:
                          'column',
                        justifyContent:
                          'flex-end',
                        alignItems:
                          'center',
                        gap: '8px',
                      }}
                    >
                      <strong>
                        {item.count}
                      </strong>

                      <div
                        title={`${item.count} tickets`}
                        style={{
                          width: '70%',
                          maxWidth: '70px',
                          height: `${height}px`,
                          borderRadius:
                            '6px 6px 0 0',
                          background:
                            '#2563eb',
                          minHeight: '4px',
                        }}
                      />

                      <small>
                        {item.label}
                      </small>
                    </div>
                  )
                },
              )}
            </div>
          </section>

          {/* =====================================================
              ÁREAS Y TIPOS
          ===================================================== */}

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            <article className="card">
              <p className="eyebrow">
                DISTRIBUCIÓN
              </p>

              <h2>
                Tickets por área
              </h2>

              {ticketsByArea.length ===
              0 ? (
                <p>
                  No hay datos de áreas.
                </p>
              ) : (
                <div
                  style={{
                    marginTop: '20px',
                    display: 'flex',
                    flexDirection:
                      'column',
                    gap: '14px',
                  }}
                >
                  {ticketsByArea.map(
                    (item) => (
                      <div
                        key={item.name}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            marginBottom:
                              '5px',
                          }}
                        >
                          <span>
                            {item.name}
                          </span>

                          <strong>
                            {item.count}
                          </strong>
                        </div>

                        <div
                          style={{
                            height: '10px',
                            borderRadius:
                              '5px',
                            background:
                              '#e5e7eb',
                            overflow:
                              'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${
                                (item.count /
                                  maxTicketsPerArea) *
                                100
                              }%`,
                              height:
                                '100%',
                              background:
                                '#2563eb',
                            }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </article>

            <article className="card">
              <p className="eyebrow">
                INCIDENCIAS
              </p>

              <h2>
                Tickets por tipo
              </h2>

              {ticketsByType.length ===
              0 ? (
                <p>
                  No hay datos de tipos.
                </p>
              ) : (
                <div
                  style={{
                    marginTop: '20px',
                    display: 'flex',
                    flexDirection:
                      'column',
                    gap: '14px',
                  }}
                >
                  {ticketsByType.map(
                    (item) => (
                      <div
                        key={item.type}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            marginBottom:
                              '5px',
                          }}
                        >
                          <span>
                            {item.label}
                          </span>

                          <strong>
                            {item.count}
                          </strong>
                        </div>

                        <div
                          style={{
                            height: '10px',
                            borderRadius:
                              '5px',
                            background:
                              '#e5e7eb',
                            overflow:
                              'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${
                                (item.count /
                                  maxTicketsPerType) *
                                100
                              }%`,
                              height:
                                '100%',
                              background:
                                '#374151',
                            }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </article>
          </section>

          {/* =====================================================
              TABLA
          ===================================================== */}

          {tickets.length === 0 ? (
            <section className="card">
              <h2>
                No hay tickets registrados
              </h2>

              <p>
                Las incidencias aparecerán
                aquí cuando sean registradas.
              </p>
            </section>
          ) : (
            <section className="card">
              <div className="page-header">
                <div>
                  <p className="eyebrow">
                    OPERACIÓN
                  </p>

                  <h2>
                    Tickets registrados
                  </h2>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Ticket
                      </th>
                      <th>
                        Tipo
                      </th>
                      <th>
                        Estado
                      </th>
                      <th>
                        Sitio
                      </th>
                      <th>
                        Área
                      </th>
                      <th>
                        Habitación
                      </th>
                      <th>
                        Dispositivo
                      </th>
                      <th>
                        Fecha
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets.map(
                      (ticket) => (
                        <tr
                          key={
                            ticket.id
                          }
                        >
                          <td>
                            <strong>
                              {ticket.title ||
                                ticket.description ||
                                ticket.id}
                            </strong>
                          </td>

                          <td>
                            {typeLabels[
                              ticket.type ??
                                ''
                            ] ??
                              ticket.type ??
                              '—'}
                          </td>

                          <td>
                            {statusLabels[
                              ticket.status ??
                                ''
                            ] ??
                              ticket.status ??
                              '—'}
                          </td>

                          <td>
                            {ticket.site
                              ?.name ??
                              '—'}
                          </td>

                          <td>
                            {ticket.area
                              ?.name ??
                              'Sin área'}
                          </td>

                          <td>
                            {ticket.room
                              ?.number ??
                              '—'}
                          </td>

                          <td>
                            {ticket.device
                              ?.hostname ??
                              '—'}
                          </td>

                          <td>
                            {ticket.createdAt
                              ? new Date(
                                  ticket.createdAt,
                                ).toLocaleString(
                                  'es-MX',
                                )
                              : '—'}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default TicketsPage