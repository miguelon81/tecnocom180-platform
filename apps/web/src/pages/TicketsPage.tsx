import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

type Ticket = {
  id: string
  title?: string | null
  description?: string | null
  status?: string | null
  type?: string | null
  createdAt?: string
  room?: {
    number: string
  } | null
  device?: {
    hostname?: string | null
  } | null
}

function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true)
        setError('')

        const response = await apiFetch('/tickets')

        if (!response.ok) {
          throw new Error('Failed to fetch tickets')
        }

        const data = await response.json()
        setTickets(data)
      } catch (err) {
        console.error(err)
        setError('No se pudieron cargar los tickets')
      } finally {
        setLoading(false)
      }
    }

    loadTickets()
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <p>Gestión de incidencias y solicitudes.</p>
        </div>
      </div>

      {loading && <p>Cargando tickets...</p>}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="empty-state">
          <h2>No hay tickets registrados</h2>
          <p>
            Las incidencias aparecerán aquí cuando sean registradas.
          </p>
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Habitación</th>
                <th>Dispositivo</th>
                <th>Fecha</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    {ticket.title ||
                      ticket.description ||
                      ticket.id}
                  </td>

                  <td>{ticket.type ?? '—'}</td>

                  <td>{ticket.status ?? '—'}</td>

                  <td>
                    {ticket.room?.number ?? '—'}
                  </td>

                  <td>
                    {ticket.device?.hostname ?? '—'}
                  </td>

                  <td>
                    {ticket.createdAt
                      ? new Date(
                          ticket.createdAt,
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

export default TicketsPage