import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

type DashboardData = {
  sites: number
  rooms: number
  devices: number
  tickets: number
}

async function getCount(path: string): Promise<number> {
  const response = await apiFetch(path)

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`)
  }

  const data = await response.json()

  if (Array.isArray(data)) {
    return data.length
  }

  if (Array.isArray(data.value)) {
    return data.value.length
  }

  return 0
}

function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    sites: 0,
    rooms: 0,
    devices: 0,
    tickets: 0,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)

      const [
        sitesCount,
        roomsCount,
        devicesCount,
        ticketsCount,
      ] = await Promise.all([
        getCount('/sites'),
        getCount('/rooms'),
        getCount('/devices'),
        getCount('/tickets'),
      ])

      setData({
        sites: sitesCount,
        rooms: roomsCount,
        devices: devicesCount,
        tickets: ticketsCount,
      })
    } catch (err) {
      console.error('Error loading dashboard:', err)

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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">TECNOCOM180 PLATFORM</p>

          <h1>Dashboard</h1>

          <p className="subtitle">
            Resumen general de la infraestructura tecnológica.
          </p>
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

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <span className="dashboard-label">Sitios</span>

          <strong>
            {loading ? '—' : data.sites}
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
            {loading ? '—' : data.rooms}
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
            {loading ? '—' : data.devices}
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
            {loading ? '—' : data.tickets}
          </strong>

          <small>
            Tickets registrados
          </small>
        </article>
      </section>

      <section className="dashboard-section">
        <div>
          <p className="eyebrow">OPERACIÓN</p>

          <h2>Estado de la plataforma</h2>
        </div>

        <div className="dashboard-status-grid">
          <div className="status-panel">
            <span className="dot dot-online" />
            API operativa
          </div>

          <div className="status-panel">
            <span className="dot dot-online" />
            Base de datos operativa
          </div>

          <div className="status-panel">
            <span className="dot dot-online" />
            Autenticación operativa
          </div>
        </div>
      </section>
    </div>
  )
}

export default DashboardPage