import { useEffect, useState } from 'react'
import { getSites } from '../api/sites'
import type {
  Room,
  Site,
  Device,
  RoomStatus,
} from '../types/site'
import { apiFetch } from '../api/client'

type Ticket = {
  id: string
  status?: string | null
}

type DashboardData = {
  sites: Site[]
  rooms: Room[]
  devices: Device[]
  tickets: Ticket[]
}

const initialData: DashboardData = {
  sites: [],
  rooms: [],
  devices: [],
  tickets: [],
}

function DashboardPage() {
  const [data, setData] =
    useState<DashboardData>(initialData)

  const [loading, setLoading] = useState(true)
  const [error, setError] =
    useState<string | null>(null)

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)

      const [sites, ticketsResponse] =
        await Promise.all([
          getSites(),
          apiFetch('/tickets'),
        ])

      if (!ticketsResponse.ok) {
        throw new Error(
          `Error HTTP ${ticketsResponse.status}`,
        )
      }

      const ticketsData =
        await ticketsResponse.json()

      const rooms = sites.flatMap(
        (site) => site.rooms,
      )

      const devices = sites.flatMap(
        (site) => site.devices,
      )

      setData({
        sites,
        rooms,
        devices,
        tickets: Array.isArray(ticketsData)
          ? ticketsData
          : [],
      })
    } catch (err) {
      console.error(
        'Error loading dashboard:',
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar el dashboard',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const onlineDevices =
    data.devices.filter(
      (device: Device) => device.online,
    ).length

  const offlineDevices =
    data.devices.length - onlineDevices

  function countRoomsByStatus(
    status: RoomStatus,
  ) {
    return data.rooms.filter(
      (room: Room) =>
        room.status === status,
    ).length
  }

  const availableRooms =
    countRoomsByStatus('AVAILABLE')

  const occupiedRooms =
    countRoomsByStatus('OCCUPIED')

  const maintenanceRooms =
    countRoomsByStatus('MAINTENANCE')

  const cleaningRooms =
    countRoomsByStatus('CLEANING')

  const openTickets =
    data.tickets.filter(
      (ticket) =>
        ticket.status === 'OPEN',
    ).length

  const inProgressTickets =
    data.tickets.filter(
      (ticket) =>
        ticket.status === 'IN_PROGRESS',
    ).length

  const resolvedTickets =
    data.tickets.filter(
      (ticket) =>
        ticket.status === 'RESOLVED',
    ).length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>Dashboard</h1>

          <p className="subtitle">
            Resumen general de la
            infraestructura tecnológica.
          </p>
        </div>
      </header>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            border:
              '1px solid #dc2626',
          }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          RESUMEN GENERAL
      ===================================================== */}

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <span className="dashboard-label">
            Sitios
          </span>

          <strong>
            {loading ? '—' : data.sites.length}
          </strong>

          <small>
            Infraestructuras registradas
          </small>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-label">
            Habitaciones
          </span>

          <strong>
            {loading ? '—' : data.rooms.length}
          </strong>

          <small>
            Habitaciones registradas
          </small>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-label">
            Dispositivos
          </span>

          <strong>
            {loading
              ? '—'
              : data.devices.length}
          </strong>

          <small>
            Dispositivos registrados
          </small>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-label">
            Tickets
          </span>

          <strong>
            {loading
              ? '—'
              : data.tickets.length}
          </strong>

          <small>
            Incidencias registradas
          </small>
        </article>
      </section>

      {/* =====================================================
          OPERACIÓN
      ===================================================== */}

      <section className="dashboard-section">
        <div>
          <p className="eyebrow">
            OPERACIÓN
          </p>

          <h2>
            Estado de dispositivos
          </h2>
        </div>

        <div className="dashboard-status-grid">
          <div className="status-panel">
            <span className="dot dot-online" />

            <strong>
              {loading
                ? '—'
                : onlineDevices}
            </strong>

            <span>
              dispositivos online
            </span>
          </div>

          <div className="status-panel">
            <span className="dot dot-offline" />

            <strong>
              {loading
                ? '—'
                : offlineDevices}
            </strong>

            <span>
              dispositivos offline
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================
          HABITACIONES
      ===================================================== */}

      <section className="dashboard-section">
        <div>
          <p className="eyebrow">
            HABITACIONES
          </p>

          <h2>
            Estado de habitaciones
          </h2>
        </div>

        <div className="dashboard-status-grid">
          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : availableRooms}
            </strong>

            <span>
              Disponibles
            </span>
          </div>

          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : occupiedRooms}
            </strong>

            <span>
              Ocupadas
            </span>
          </div>

          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : cleaningRooms}
            </strong>

            <span>
              Limpieza
            </span>
          </div>

          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : maintenanceRooms}
            </strong>

            <span>
              Mantenimiento
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================
          TICKETS
      ===================================================== */}

      <section className="dashboard-section">
        <div>
          <p className="eyebrow">
            INCIDENCIAS
          </p>

          <h2>
            Estado de tickets
          </h2>
        </div>

        <div className="dashboard-status-grid">
          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : openTickets}
            </strong>

            <span>
              Abiertos
            </span>
          </div>

          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : inProgressTickets}
            </strong>

            <span>
              En proceso
            </span>
          </div>

          <div className="status-panel">
            <strong>
              {loading
                ? '—'
                : resolvedTickets}
            </strong>

            <span>
              Resueltos
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default DashboardPage