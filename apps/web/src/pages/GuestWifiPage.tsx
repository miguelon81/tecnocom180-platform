import {
  useEffect,
  useState,
} from 'react'
import { useParams } from 'react-router-dom'

type PublicWifiResponse = {
  guest: {
    name: string
  }
  room: {
    number: string
  }
  wifi: {
    username: string | null
    password: string | null
    expiresAt: string
    maxDevices?: number
  }
}

export default function GuestWifiPage() {
  const { token } = useParams<{
    token: string
  }>()

  const [data, setData] =
    useState<PublicWifiResponse | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    async function loadAccess() {
      if (!token) {
        setError(
          'El enlace de acceso WiFi no es válido.',
        )
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const API_URL =
          import.meta.env.VITE_API_URL

        const response = await fetch(
          `${API_URL}/guests/wifi/public/${token}`,
        )

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(
              'El acceso WiFi no existe.',
            )
          }

          if (response.status === 410) {
            throw new Error(
              'Este acceso WiFi ya no está disponible.',
            )
          }

          throw new Error(
            'No fue posible consultar el acceso WiFi.',
          )
        }

        const result =
          (await response.json()) as PublicWifiResponse

        setData(result)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No fue posible consultar el acceso WiFi.',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadAccess()
  }, [token])

  function formatDate(
    value: string,
  ) {
    return new Date(
      value,
    ).toLocaleString(
      'es-MX',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      },
    )
  }

  if (loading) {
    return (
      <main className="guest-public-page">
        <div className="guest-public-message">
          Cargando acceso WiFi...
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="guest-public-page">
        <div className="guest-public-card guest-public-error">
          <div className="guest-public-brand">
            TECNOCOM180
          </div>

          <h1>
            Acceso no disponible
          </h1>

          <p>
            {error ??
              'No fue posible consultar este acceso.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="guest-public-page">
      <div className="guest-public-card">
        <div className="guest-public-head">
          <div className="guest-public-brand">
            TECNOCOM180
          </div>

          <h1>
            Acceso WiFi
          </h1>

          <p>
            Bienvenido, {data.guest.name}
          </p>
        </div>

        <div className="guest-public-room">
          <span>
            Habitación
          </span>

          <strong>
            {data.room.number}
          </strong>
        </div>

        <div className="guest-public-credentials">
          <div>
            <span>
              Usuario
            </span>

            <strong>
              {data.wifi.username ?? '—'}
            </strong>
          </div>

          <div>
            <span>
              Contraseña
            </span>

            <strong>
              {data.wifi.password ?? '—'}
            </strong>
          </div>

          {data.wifi.maxDevices !== undefined && (
            <div>
              <span>
                Dispositivos permitidos
              </span>

              <strong>
                Hasta {data.wifi.maxDevices}
              </strong>
            </div>
          )}
        </div>

        <div className="guest-public-expiry">
          Este acceso vence el{' '}
          <strong>
            {formatDate(
              data.wifi.expiresAt,
            )}
          </strong>
        </div>

        <div className="guest-public-footer">
          TECNOCOM180 · Acceso para huéspedes
        </div>
      </div>
    </main>
  )
}
