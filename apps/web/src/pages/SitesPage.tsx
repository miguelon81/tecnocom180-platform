import { useEffect, useState } from 'react'
import { getSites } from '../api/sites'
import type { Site } from '../types/site'

function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSites()
  .then((data) => {
    setSites(data)
  })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="page">Cargando sitios...</div>
  }

  if (error) {
    return (
      <div className="page">
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">TECNOCOM180 PLATFORM</p>
          <h1>Sitios</h1>
          <p className="subtitle">
            Gestión y supervisión de infraestructura tecnológica.
          </p>
        </div>

        <div className="site-count">
          {sites.length} {sites.length === 1 ? 'sitio' : 'sitios'}
        </div>
      </header>

      <section className="sites-grid">
        {sites.map((site) => {
          const onlineDevices = site.devices.filter(
            (device) => device.online,
          ).length

          const offlineDevices = site.devices.length - onlineDevices

          return (
            <article className="site-card" key={site.id}>
              <div className="site-card-header">
                <div>
                  <p className="site-code">{site.code}</p>
                  <h2>{site.name}</h2>
                </div>

                <span
                  className={`status ${
                    site.active ? 'status-active' : 'status-inactive'
                  }`}
                >
                  {site.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <p className="site-location">
                {site.city}, {site.state}, {site.country}
              </p>

              <div className="site-stats">
                <div>
                  <strong>{site.rooms.length}</strong>
                  <span>Habitaciones</span>
                </div>

                <div>
                  <strong>{site.areas.length}</strong>
                  <span>Áreas</span>
                </div>

                <div>
                  <strong>{site.devices.length}</strong>
                  <span>Dispositivos</span>
                </div>
              </div>

              <div className="device-status">
                <span>
                  <i className="dot dot-online" />
                  {onlineDevices} online
                </span>

                <span>
                  <i className="dot dot-offline" />
                  {offlineDevices} offline
                </span>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

export default SitesPage
