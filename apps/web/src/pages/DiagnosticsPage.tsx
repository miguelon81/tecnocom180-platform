import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

type SpeedtestResult = {
  interface: string
  downloadMbps?: number | null
  uploadMbps?: number | null
  latencyMs?: number | null
  jitterMs?: number | null
  packetLoss?: number | null
  server?: string | null
}

type RawDiagnosticResult = {
  status?: string
  summary?: {
    pass?: number
    warning?: number
    fail?: number
    skip?: number
  }
  internetRoute?: {
    interface?: string
    sourceIp?: string
    gateway?: string
  }
  latency?: {
    pingMs?: number | null
    packetLoss?: number | null
  }
  dns?: {
    servers?: string[]
    operational?: boolean
  }
  internet?: boolean
  wifi?: {
    ssid?: string
    bssid?: string
    frequencyMHz?: number | null
    signalDbm?: number | null
    rxBitrateMbps?: number | null
    txBitrateMbps?: number | null
  }
  speedtest?: {
    ethernet?: SpeedtestResult
    wifi?: SpeedtestResult
  }
}

type DiagnosticResult = {
  id: string
  pingMs?: number | null
  downloadMbps?: number | null
  uploadMbps?: number | null
  packetLoss?: number | null
  gateway?: string | null
  dns?: string | null
  internet?: boolean | null
  rawResult?: RawDiagnosticResult | null
}

type Diagnostic = {
  id: string
  organizationId?: string
  status: string
  startedAt: string
  finishedAt?: string | null
  result?: DiagnosticResult | null
}

type DiagnosticsResponse = Diagnostic[]

function formatNumber(
  value: number | null | undefined,
  suffix = '',
  decimals = 2,
) {
  if (value === null || value === undefined) {
    return '—'
  }

  return `${value.toFixed(decimals)}${suffix}`
}

function statusLabel(status: string) {
  switch (status) {
    case 'SUCCESS':
      return 'Correcto'
    case 'WARNING':
      return 'Advertencia'
    case 'FAIL':
      return 'Fallo'
    case 'RUNNING':
      return 'Ejecutando'
    default:
      return status
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'SUCCESS':
      return 'status-success'
    case 'WARNING':
      return 'status-warning'
    case 'FAIL':
      return 'status-fail'
    case 'RUNNING':
      return 'status-running'
    default:
      return ''
  }
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="diagnostic-metric">
      <span className="diagnostic-metric-label">{label}</span>
      <strong>{value}</strong>
      {unit && <small>{unit}</small>}
    </div>
  )
}

function Histogram({
  label,
  value,
  max,
  unit,
}: {
  label: string
  value: number | null | undefined
  max: number
  unit: string
}) {
  const numericValue =
    value === null || value === undefined ? 0 : Math.max(0, value)

  const percentage = Math.min((numericValue / max) * 100, 100)

  return (
    <div className="diagnostic-histogram">
      <div className="diagnostic-histogram-header">
        <span>{label}</span>

        <strong>
          {value === null || value === undefined
            ? '—'
            : `${formatNumber(value)} ${unit}`}
        </strong>
      </div>

      <div className="diagnostic-histogram-track">
        <div
          className="diagnostic-histogram-bar"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function SummaryHistogram({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className: string
}) {
  return (
    <div className={`diagnostic-summary ${className}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Diagnostic | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDiagnostics() {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/diagnostics')

      if (!response.ok) {
        throw new Error(
          `Error al cargar diagnósticos: ${response.status}`,
        )
      }

      /*
       * El endpoint /diagnostics devuelve directamente
       * un array de diagnósticos:
       *
       * [
       *   { ... },
       *   { ... }
       * ]
       */
      const data = (await response.json()) as DiagnosticsResponse

      setDiagnostics(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible cargar los diagnósticos',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDiagnostics()
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Diagnósticos</h1>

          <p>
            Historial y resultados del motor de diagnóstico de red
            TECNOCOM180.
          </p>
        </div>

        <button
          type="button"
          className="button-primary"
          onClick={() => void loadDiagnostics()}
        >
          Actualizar
        </button>
      </div>

      {loading && <p>Cargando diagnósticos...</p>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && diagnostics.length === 0 && (
        <div className="empty-state">
          No existen diagnósticos registrados.
        </div>
      )}

      {!loading && !error && diagnostics.length > 0 && (
        <div className="diagnostics-table-wrapper">
          <table className="diagnostics-table">
            <thead>
              <tr>
                <th>Diagnóstico</th>
                <th>Estado</th>
                <th>Ping</th>
                <th>Download</th>
                <th>Upload</th>
                <th>Pérdida</th>
                <th>Gateway</th>
                <th>Internet</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {diagnostics.map((diagnostic) => {
                const result = diagnostic.result
                const raw = result?.rawResult
                const speedtest = raw?.speedtest

                /*
                 * Para la tabla mostramos Ethernet como referencia
                 * principal cuando existe Speedtest.
                 */
                const ethernet = speedtest?.ethernet

                /*
                 * El status SUCCESS significa que el diagnóstico
                 * terminó correctamente.
                 *
                 * El status real de la red está dentro de rawResult.status.
                 */
                const networkStatus =
                  raw?.status ?? diagnostic.status

                return (
                  <tr key={diagnostic.id}>
                    <td>
                      <code>{diagnostic.id}</code>
                    </td>

                    <td>
                      <span
                        className={`diagnostic-status ${statusClass(
                          networkStatus,
                        )}`}
                      >
                        {statusLabel(networkStatus)}
                      </span>
                    </td>

                    <td>
                      {formatNumber(result?.pingMs, ' ms')}
                    </td>

                    <td>
                      {formatNumber(
                        ethernet?.downloadMbps,
                        ' Mbps',
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        ethernet?.uploadMbps,
                        ' Mbps',
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        result?.packetLoss,
                        ' %',
                      )}
                    </td>

                    <td>
                      {result?.gateway ?? '—'}
                    </td>

                    <td>
                      {result?.internet === true
                        ? 'Sí'
                        : result?.internet === false
                          ? 'No'
                          : '—'}
                    </td>

                    <td>
                      {new Date(
                        diagnostic.startedAt,
                      ).toLocaleString()}
                    </td>

                    <td>
                      {diagnostic.finishedAt
                        ? new Date(
                            diagnostic.finishedAt,
                          ).toLocaleString()
                        : '—'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() =>
                          setSelected(diagnostic)
                        }
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="diagnostic-modal-backdrop">
          <div className="diagnostic-modal">
            <div className="diagnostic-modal-header">
              <div>
                <h2>Detalle del diagnóstico</h2>

                <code>{selected.id}</code>
              </div>

              <button
                type="button"
                className="button-secondary"
                onClick={() => setSelected(null)}
              >
                Cerrar
              </button>
            </div>

            {(() => {
              const result = selected.result
              const raw = result?.rawResult

              const summary = raw?.summary
              const route = raw?.internetRoute
              const latency = raw?.latency
              const dns = raw?.dns
              const wifi = raw?.wifi

              const ethernetSpeed =
                raw?.speedtest?.ethernet

              const wifiSpeed =
                raw?.speedtest?.wifi

              const networkStatus =
                raw?.status ?? selected.status

              return (
                <>
                  {/* ================================================= */}
                  {/* MOTOR V8 */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>Resultado del motor V8</h3>

                    <div className="diagnostic-status-large">
                      <span>Estado</span>

                      <strong
                        className={statusClass(
                          networkStatus,
                        )}
                      >
                        {statusLabel(networkStatus)}
                      </strong>
                    </div>

                    <div className="diagnostic-summary-grid">
                      <SummaryHistogram
                        label="PASS"
                        value={summary?.pass ?? 0}
                        className="summary-pass"
                      />

                      <SummaryHistogram
                        label="WARNING"
                        value={summary?.warning ?? 0}
                        className="summary-warning"
                      />

                      <SummaryHistogram
                        label="FAIL"
                        value={summary?.fail ?? 0}
                        className="summary-fail"
                      />

                      <SummaryHistogram
                        label="SKIP"
                        value={summary?.skip ?? 0}
                        className="summary-skip"
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* RUTA */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>Ruta a Internet</h3>

                    <div className="diagnostic-metric-grid">
                      <MetricCard
                        label="Interfaz"
                        value={
                          route?.interface ?? '—'
                        }
                      />

                      <MetricCard
                        label="IP origen"
                        value={
                          route?.sourceIp ?? '—'
                        }
                      />

                      <MetricCard
                        label="Gateway"
                        value={
                          route?.gateway ?? '—'
                        }
                      />

                      <MetricCard
                        label="Internet"
                        value={
                          raw?.internet === true
                            ? 'Sí'
                            : raw?.internet === false
                              ? 'No'
                              : '—'
                        }
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* LATENCIA */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>Latencia y pérdida</h3>

                    <div className="diagnostic-metric-grid">
                      <MetricCard
                        label="Ping al gateway"
                        value={formatNumber(
                          latency?.pingMs,
                          ' ms',
                        )}
                      />

                      <MetricCard
                        label="Pérdida"
                        value={formatNumber(
                          latency?.packetLoss,
                          ' %',
                        )}
                      />
                    </div>

                    <div className="diagnostic-histogram-grid">
                      <Histogram
                        label="Latencia"
                        value={latency?.pingMs}
                        max={100}
                        unit="ms"
                      />

                      <Histogram
                        label="Pérdida"
                        value={latency?.packetLoss}
                        max={100}
                        unit="%"
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* SPEEDTEST ETHERNET */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>Speedtest — Ethernet</h3>

                    <div className="diagnostic-metric-grid">
                      <MetricCard
                        label="Interfaz"
                        value={
                          ethernetSpeed?.interface ??
                          '—'
                        }
                      />

                      <MetricCard
                        label="Download"
                        value={formatNumber(
                          ethernetSpeed?.downloadMbps,
                          ' Mbps',
                        )}
                      />

                      <MetricCard
                        label="Upload"
                        value={formatNumber(
                          ethernetSpeed?.uploadMbps,
                          ' Mbps',
                        )}
                      />

                      <MetricCard
                        label="Latencia"
                        value={formatNumber(
                          ethernetSpeed?.latencyMs,
                          ' ms',
                        )}
                      />

                      <MetricCard
                        label="Jitter"
                        value={formatNumber(
                          ethernetSpeed?.jitterMs,
                          ' ms',
                        )}
                      />

                      <MetricCard
                        label="Pérdida"
                        value={formatNumber(
                          ethernetSpeed?.packetLoss,
                          ' %',
                        )}
                      />

                      <MetricCard
                        label="Servidor"
                        value={
                          ethernetSpeed?.server ??
                          '—'
                        }
                      />
                    </div>

                    <div className="diagnostic-histogram-grid">
                      <Histogram
                        label="Download"
                        value={
                          ethernetSpeed?.downloadMbps
                        }
                        max={1000}
                        unit="Mbps"
                      />

                      <Histogram
                        label="Upload"
                        value={
                          ethernetSpeed?.uploadMbps
                        }
                        max={1000}
                        unit="Mbps"
                      />

                      <Histogram
                        label="Latencia"
                        value={
                          ethernetSpeed?.latencyMs
                        }
                        max={100}
                        unit="ms"
                      />

                      <Histogram
                        label="Jitter"
                        value={
                          ethernetSpeed?.jitterMs
                        }
                        max={50}
                        unit="ms"
                      />

                      <Histogram
                        label="Pérdida"
                        value={
                          ethernetSpeed?.packetLoss
                        }
                        max={100}
                        unit="%"
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* SPEEDTEST WIFI */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>Speedtest — WiFi</h3>

                    <div className="diagnostic-metric-grid">
                      <MetricCard
                        label="Interfaz"
                        value={
                          wifiSpeed?.interface ??
                          '—'
                        }
                      />

                      <MetricCard
                        label="Download"
                        value={formatNumber(
                          wifiSpeed?.downloadMbps,
                          ' Mbps',
                        )}
                      />

                      <MetricCard
                        label="Upload"
                        value={formatNumber(
                          wifiSpeed?.uploadMbps,
                          ' Mbps',
                        )}
                      />

                      <MetricCard
                        label="Latencia"
                        value={formatNumber(
                          wifiSpeed?.latencyMs,
                          ' ms',
                        )}
                      />

                      <MetricCard
                        label="Jitter"
                        value={formatNumber(
                          wifiSpeed?.jitterMs,
                          ' ms',
                        )}
                      />

                      <MetricCard
                        label="Pérdida"
                        value={formatNumber(
                          wifiSpeed?.packetLoss,
                          ' %',
                        )}
                      />

                      <MetricCard
                        label="Servidor"
                        value={
                          wifiSpeed?.server ??
                          '—'
                        }
                      />
                    </div>

                    <div className="diagnostic-histogram-grid">
                      <Histogram
                        label="Download"
                        value={
                          wifiSpeed?.downloadMbps
                        }
                        max={1000}
                        unit="Mbps"
                      />

                      <Histogram
                        label="Upload"
                        value={
                          wifiSpeed?.uploadMbps
                        }
                        max={1000}
                        unit="Mbps"
                      />

                      <Histogram
                        label="Latencia"
                        value={
                          wifiSpeed?.latencyMs
                        }
                        max={100}
                        unit="ms"
                      />

                      <Histogram
                        label="Jitter"
                        value={
                          wifiSpeed?.jitterMs
                        }
                        max={50}
                        unit="ms"
                      />

                      <Histogram
                        label="Pérdida"
                        value={
                          wifiSpeed?.packetLoss
                        }
                        max={100}
                        unit="%"
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* WIFI PHY */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>WiFi — enlace</h3>

                    <div className="diagnostic-metric-grid">
                      <MetricCard
                        label="SSID"
                        value={
                          wifi?.ssid ?? '—'
                        }
                      />

                      <MetricCard
                        label="BSSID"
                        value={
                          wifi?.bssid ?? '—'
                        }
                      />

                      <MetricCard
                        label="Frecuencia"
                        value={formatNumber(
                          wifi?.frequencyMHz,
                          ' MHz',
                          0,
                        )}
                      />

                      <MetricCard
                        label="Señal"
                        value={formatNumber(
                          wifi?.signalDbm,
                          ' dBm',
                        )}
                      />

                      <MetricCard
                        label="RX PHY"
                        value={formatNumber(
                          wifi?.rxBitrateMbps,
                          ' Mbps',
                        )}
                      />

                      <MetricCard
                        label="TX PHY"
                        value={formatNumber(
                          wifi?.txBitrateMbps,
                          ' Mbps',
                        )}
                      />
                    </div>

                    <div className="diagnostic-histogram-grid">
                      <Histogram
                        label="Señal WiFi"
                        value={
                          wifi?.signalDbm !==
                            null &&
                          wifi?.signalDbm !==
                            undefined
                            ? Math.abs(
                                wifi.signalDbm,
                              )
                            : null
                        }
                        max={100}
                        unit="dBm"
                      />

                      <Histogram
                        label="RX PHY"
                        value={
                          wifi?.rxBitrateMbps
                        }
                        max={1000}
                        unit="Mbps"
                      />

                      <Histogram
                        label="TX PHY"
                        value={
                          wifi?.txBitrateMbps
                        }
                        max={1000}
                        unit="Mbps"
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* DNS */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <h3>DNS</h3>

                    <div className="diagnostic-metric-grid">
                      <MetricCard
                        label="Servidores"
                        value={
                          dns?.servers?.join(
                            ', ',
                          ) ?? '—'
                        }
                      />

                      <MetricCard
                        label="Operativo"
                        value={
                          dns?.operational === true
                            ? 'Sí'
                            : dns?.operational ===
                                false
                              ? 'No'
                              : '—'
                        }
                      />
                    </div>
                  </section>

                  {/* ================================================= */}
                  {/* JSON */}
                  {/* ================================================= */}

                  <section className="diagnostic-section">
                    <details>
                      <summary>
                        Ver JSON completo recibido
                      </summary>

                      <pre className="diagnostic-json">
                        {JSON.stringify(
                          raw ?? result,
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </section>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
