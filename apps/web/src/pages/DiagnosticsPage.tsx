import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

type Diagnostic = {
  id: string
  status?: string | null
  createdAt?: string
  device?: {
    hostname?: string | null
  } | null
}

function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDiagnostics() {
      try {
        setLoading(true)
        setError('')

        const response = await apiFetch('/diagnostics')

        if (!response.ok) {
          throw new Error('Failed to fetch diagnostics')
        }

        const data = await response.json()
        setDiagnostics(data)
      } catch (err) {
        console.error(err)
        setError('No se pudieron cargar los diagnósticos')
      } finally {
        setLoading(false)
      }
    }

    loadDiagnostics()
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Diagnósticos</h1>
          <p>
            Historial de pruebas y diagnósticos de red.
          </p>
        </div>
      </div>

      {loading && <p>Cargando diagnósticos...</p>}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && !error && diagnostics.length === 0 && (
        <div className="empty-state">
          <h2>No hay diagnósticos registrados</h2>
          <p>
            Las ejecuciones de diagnóstico aparecerán aquí.
          </p>
        </div>
      )}

      {!loading && !error && diagnostics.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dispositivo</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>

            <tbody>
              {diagnostics.map((diagnostic) => (
                <tr key={diagnostic.id}>
                  <td>{diagnostic.id}</td>

                  <td>
                    {diagnostic.device?.hostname ?? '—'}
                  </td>

                  <td>
                    {diagnostic.status ?? '—'}
                  </td>

                  <td>
                    {diagnostic.createdAt
                      ? new Date(
                          diagnostic.createdAt,
                        ).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DiagnosticsPage