import { useEffect, useState } from 'react'

import { getSites } from '../api/sites'
import type {
  Room,
  Site,
  Device,
  RoomStatus,
} from '../types/site'

import { apiFetch } from '../api/client'

import {
  getLatestTelemetry,
} from '../api/telemetry'

import type {
  DeviceTelemetry,
} from '../api/telemetry'

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

type TelemetryState = {
  loading: boolean
  telemetry: DeviceTelemetry | null
  error: string | null
}

const initialData: DashboardData = {
  sites: [],
  rooms: [],
  devices: [],
  tickets: [],
}

function formatTelemetryDate(
  value: string,
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-MX')
}

function formatNumber(
  value: number | null,
  suffix = '',
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—'
  }

  return `${value}${suffix}`
}

function DashboardPage() {
  const [data, setData] =
    useState<DashboardData>(
      initialData,
    )

  const [telemetry, setTelemetry] =
    useState<
      Record<string, TelemetryState>
    >({})

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)

      const [
        sites,
        ticketsResponse,
      ] = await Promise.all([
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

      const rooms =
        sites.flatMap(
          (site) => site.rooms,
        )

      const devices =
        sites.flatMap(
          (site) => site.devices,
        )

      setData({
        sites,
        rooms,
        devices,
        tickets:
          Array.isArray(
            ticketsData,
          )
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

  /*
   * Identificamos cisternas por el tipo
   * del área asociada.
   *
   * Esto permite que el nodo TC180 pueda
   * funcionar aunque su modelo todavía
   * esté registrado como ACCESS_POINT.
   */
  const cisternDevices =
    data.devices.filter(
      (device) => {
        const site =
          data.sites.find(
            (item) =>
              item.id ===
              device.siteId,
          )

        const area =
          site?.areas.find(
            (item) =>
              item.id ===
              device.areaId,
          )

        return (
          area?.type?.toLowerCase() ===
          'cisterna'
        )
      },
    )

  /*
   * IoT que todavía no son cisternas.
   *
   * Cuando registremos sensores de
   * temperatura/humedad podremos mostrarlos
   * aquí sin modificar la estructura general.
   */
  const otherIoTDevices =
    data.devices.filter(
      (device) => {
        const isIoT =
          device.model?.type === 'IOT'

        const isCistern =
          cisternDevices.some(
            (item) =>
              item.id ===
              device.id,
          )

        return (
          isIoT &&
          !isCistern
        )
      },
    )

  async function loadCisternTelemetry(
    deviceId: string,
  ) {
    setTelemetry(
      (current) => ({
        ...current,
        [deviceId]: {
          loading: true,
          telemetry:
            current[
              deviceId
            ]?.telemetry ??
            null,
          error: null,
        },
      }),
    )

    try {
      const response =
        await getLatestTelemetry(
          deviceId,
        )

      setTelemetry(
        (current) => ({
          ...current,
          [deviceId]: {
            loading: false,
            telemetry:
              response.telemetry ??
              null,
            error: null,
          },
        }),
      )
    } catch (err) {
      console.error(
        `Error obteniendo telemetría del dispositivo ${deviceId}:`,
        err,
      )

      setTelemetry(
        (current) => ({
          ...current,
          [deviceId]: {
            loading: false,
            telemetry: null,
            error:
              err instanceof Error
                ? err.message
                : 'No se pudo obtener la telemetría',
          },
        }),
      )
    }
  }

  /*
   * Carga inicial de telemetría.
   */
  useEffect(() => {
    if (
      cisternDevices.length ===
      0
    ) {
      return
    }

    for (const device of cisternDevices) {
      loadCisternTelemetry(
        device.id,
      )
    }
  }, [
    cisternDevices
      .map((device) => device.id)
      .join(','),
  ])

  /*
   * Actualización automática cada 10 segundos.
   */
  useEffect(() => {
    if (
      cisternDevices.length ===
      0
    ) {
      return
    }

    const interval =
      window.setInterval(() => {
        for (
          const device of cisternDevices
        ) {
          loadCisternTelemetry(
            device.id,
          )
        }
      }, 10000)

    return () => {
      window.clearInterval(
        interval,
      )
    }
  }, [
    cisternDevices
      .map((device) => device.id)
      .join(','),
  ])

  const onlineDevices =
    data.devices.filter(
      (device: Device) =>
        device.online,
    ).length

  const offlineDevices =
    data.devices.length -
    onlineDevices

  function countRoomsByStatus(
    status: RoomStatus,
  ) {
    return data.rooms.filter(
      (room: Room) =>
        room.status === status,
    ).length
  }

  const availableRooms =
    countRoomsByStatus(
      'AVAILABLE',
    )

  const occupiedRooms =
    countRoomsByStatus(
      'OCCUPIED',
    )

  const maintenanceRooms =
    countRoomsByStatus(
      'MAINTENANCE',
    )

  const cleaningRooms =
    countRoomsByStatus(
      'CLEANING',
    )

  const openTickets =
    data.tickets.filter(
      (ticket) =>
        ticket.status === 'OPEN',
    ).length

  const inProgressTickets =
    data.tickets.filter(
      (ticket) =>
        ticket.status ===
        'IN_PROGRESS',
    ).length

  const resolvedTickets =
    data.tickets.filter(
      (ticket) =>
        ticket.status ===
        'RESOLVED',
    ).length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>
            Dashboard
          </h1>

          <p className="subtitle">
            Resumen operativo de la
            infraestructura
            tecnológica.
          </p>
        </div>
      </header>

      {error && (
        <div className="error-message">
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
            {loading
              ? '—'
              : data.sites.length}
          </strong>

          <small>
            Infraestructuras
            registradas
          </small>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-label">
            Habitaciones
          </span>

          <strong>
            {loading
              ? '—'
              : data.rooms.length}
          </strong>

          <small>
            Habitaciones
            registradas
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
            Infraestructura
            tecnológica
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
            Incidencias
            registradas
          </small>
        </article>
      </section>

      {/* =====================================================
          ESTADO DE DISPOSITIVOS
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
          CISTERNAS
      ===================================================== */}

      <section className="dashboard-section">
        <div>
          <p className="eyebrow">
            IoT / AGUA
          </p>

          <h2>
            Cisternas
          </h2>

          <p className="subtitle">
            Estado y última telemetría
            de los nodos de cisterna.
          </p>
        </div>

        {cisternDevices.length ===
        0 ? (
          <div className="card">
            <p>
              No hay cisternas
              registradas.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            {cisternDevices.map(
              (device) => {
                const state =
                  telemetry[
                    device.id
                  ]

                const latest =
                  state?.telemetry ??
                  null

                const site =
                  data.sites.find(
                    (item) =>
                      item.id ===
                      device.siteId,
                  )

                const area =
                  site?.areas.find(
                    (item) =>
                      item.id ===
                      device.areaId,
                  )

                return (
                  <article
                    className="card"
                    key={
                      device.id
                    }
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        alignItems:
                          'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <p className="eyebrow">
                          CISTERNA
                        </p>

                        <h3>
                          {device.deviceCode ??
                            device.hostname ??
                            'Nodo de cisterna'}
                        </h3>

                        <small>
                          {site?.name ??
                            'Sitio'}{' '}
                          ·{' '}
                          {area?.name ??
                            'Área'}
                        </small>
                      </div>

                      <div>
                        <span
                          className={
                            device.online
                              ? 'dot dot-online'
                              : 'dot dot-offline'
                          }
                        />

                        <small>
                          {device.online
                            ? ' Online'
                            : ' Offline'}
                        </small>
                      </div>
                    </div>

                    {state?.error && (
                      <div
                        className="error-message"
                        style={{
                          marginTop:
                            '16px',
                        }}
                      >
                        {state.error}
                      </div>
                    )}

                    {state?.loading &&
                      !latest && (
                        <p
                          style={{
                            marginTop:
                              '20px',
                          }}
                        >
                          Consultando
                          telemetría...
                        </p>
                      )}

                    {latest && (
                      <>
                        <div
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              'repeat(3, 1fr)',
                            gap: '12px',
                            marginTop:
                              '20px',
                          }}
                        >
                          <div>
                            <p className="eyebrow">
                              NIVEL
                            </p>

                            <h2>
                              {formatNumber(
                                latest.nivel,
                                '%',
                              )}
                            </h2>
                          </div>

                          <div>
                            <p className="eyebrow">
                              BATERÍA
                            </p>

                            <h2>
                              {formatNumber(
                                latest.bateria,
                                '%',
                              )}
                            </h2>
                          </div>

                          <div>
                            <p className="eyebrow">
                              SEÑAL
                            </p>

                            <h2>
                              {formatNumber(
                                latest.senal,
                                ' dBm',
                              )}
                            </h2>
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              'repeat(2, 1fr)',
                            gap: '12px',
                            marginTop:
                              '16px',
                          }}
                        >
                          <div>
                            <p className="eyebrow">
                              RECARGA
                            </p>

                            <strong>
                              {formatNumber(
                                latest.recarga,
                              )}
                            </strong>
                          </div>

                          <div>
                            <p className="eyebrow">
                              CONSUMO
                            </p>

                            <strong>
                              {formatNumber(
                                latest.consumo,
                              )}
                            </strong>
                          </div>

                          <div>
                            <p className="eyebrow">
                              RELAY
                            </p>

                            <strong>
                              {latest.relay1 ===
                              1
                                ? 'ON'
                                : latest.relay1 ===
                                    0
                                  ? 'OFF'
                                  : '—'}
                            </strong>
                          </div>

                          <div>
                            <p className="eyebrow">
                              ACTUALIZACIÓN
                            </p>

                            <strong
                              style={{
                                fontSize:
                                  '0.85rem',
                              }}
                            >
                              {formatTelemetryDate(
                                latest.createdAt,
                              )}
                            </strong>
                          </div>
                        </div>
                      </>
                    )}

                    {!latest &&
                      !state?.loading &&
                      !state?.error && (
                        <p
                          style={{
                            marginTop:
                              '20px',
                            opacity:
                              0.7,
                          }}
                        >
                          Sin telemetría
                          disponible.
                        </p>
                      )}
                  </article>
                )
              },
            )}
          </div>
        )}
      </section>

      {/* =====================================================
          OTROS IoT
      ===================================================== */}

      <section className="dashboard-section">
        <div>
          <p className="eyebrow">
            IoT
          </p>

          <h2>
            Sensores y dispositivos IoT
          </h2>

          <p className="subtitle">
            Preparado para sensores de
            temperatura, humedad y otros
            dispositivos.
          </p>
        </div>

        {otherIoTDevices.length ===
        0 ? (
          <div className="card">
            <p>
              No hay otros dispositivos
              IoT registrados.
            </p>
          </div>
        ) : (
          <div
            className="dashboard-status-grid"
          >
            {otherIoTDevices.map(
              (device) => (
                <div
                  className="status-panel"
                  key={device.id}
                >
                  <span
                    className={
                      device.online
                        ? 'dot dot-online'
                        : 'dot dot-offline'
                    }
                  />

                  <strong>
                    {device.deviceCode ??
                      device.hostname ??
                      'IoT'}
                  </strong>

                  <span>
                    {device.model
                      ?.name ??
                      'Dispositivo IoT'}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
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
