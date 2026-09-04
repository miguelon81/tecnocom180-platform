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
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-sm text-gray-500">
          Cargando acceso WiFi...
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="text-xl font-semibold">
            Acceso no disponible
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {error ??
              'No fue posible consultar este acceso.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-widest text-gray-400">
              TECNOCOM180
            </div>

            <h1 className="mt-2 text-2xl font-semibold">
              Acceso WiFi
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Bienvenido, {data.guest.name}
            </p>
          </div>

          <div className="mt-8 rounded-xl bg-gray-50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Habitación
            </div>

            <div className="mt-1 text-2xl font-semibold">
              {data.room.number}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Usuario
              </div>

              <div className="mt-1 rounded-xl border bg-white px-4 py-3 font-mono text-base">
                {data.wifi.username ?? '—'}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Contraseña
              </div>

              <div className="mt-1 rounded-xl border bg-white px-4 py-3 font-mono text-base">
                {data.wifi.password ?? '—'}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <p className="text-center text-xs text-gray-500">
              Este acceso vence el{' '}
              <strong>
                {formatDate(
                  data.wifi.expiresAt,
                )}
              </strong>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}