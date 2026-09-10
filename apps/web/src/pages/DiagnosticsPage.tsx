import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { useSites } from '../sites/SiteContext'

type SpeedtestResult = {
  interface: string
  downloadMbps?: number | null
  uploadMbps?: number | null
  latencyMs?: number | null
  jitterMs?: number | null
  packetLoss?: number | null
  server?: string | null
}
type DiagnosticFinding = {
  severity: 'WARNING' | 'FAIL' | 'SKIP'
  message: string
}

type RawDiagnosticResult = {
  status?: string
  summary?: {
    pass?: number
    warning?: number
    fail?: number
    skip?: number
  }
  findings?: DiagnosticFinding[]
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
  siteId?: string | null
  site?: {
    id: string
    name: string
    code: string
  } | null
  status: string
  startedAt: string
  finishedAt?: string | null
  result?: DiagnosticResult | null
}

type DiagnosticsResponse = Diagnostic[]

type DiagnosticAgent = {
  id: string
  deviceCode?: string | null
  name?: string | null
  hostname?: string | null
  ip?: string | null
  firmware?: string | null
  online: boolean
  lastSeenAt?: string | null
  model?: {
    id: string
    name: string
    type: string
    brand?: {
      id: string
      name: string
    } | null
  } | null
}

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

    case 'PASS':
      return 'Correcto'

    case 'WARNING':
      return 'Advertencia'

    case 'FAIL':
    case 'FAILED':
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
    case 'PASS':
      return 'status-success'

    case 'WARNING':
      return 'status-warning'

    case 'FAIL':
    case 'FAILED':
      return 'status-fail'

    case 'SKIP':
      return 'status-skip'

    case 'RUNNING':
      return 'status-running'

    default:
      return ''
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleString()
}

const AGENT_STALE_MS = 90 * 1000

function isAgentOnline(
  agent: DiagnosticAgent | null,
) {
  if (
    !agent ||
    !agent.online ||
    !agent.lastSeenAt
  ) {
    return false
  }

  const lastSeen =
    new Date(agent.lastSeenAt).getTime()

  if (Number.isNaN(lastSeen)) {
    return false
  }

  return (
    Date.now() - lastSeen <=
    AGENT_STALE_MS
  )
}

function formatLastSeen(
  value?: string | null,
) {
  if (!value) {
    return 'Sin comunicación registrada'
  }

  const timestamp =
    new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return 'Fecha desconocida'
  }

  const seconds =
    Math.max(
      0,
      Math.floor(
        (Date.now() - timestamp) /
          1000,
      ),
    )

  if (seconds < 60) {
    return `Hace ${seconds} s`
  }

  const minutes =
    Math.floor(seconds / 60)

  if (minutes < 60) {
    return `Hace ${minutes} min`
  }

  const hours =
    Math.floor(minutes / 60)

  return `Hace ${hours} h`
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="diagnostic-detail-metric">
      <span>{label}</span>

      <strong>{value}</strong>

      {detail && <small>{detail}</small>}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className: string
}) {
  return (
    <div className={`diagnostic-summary-card ${className}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function DiagnosticsPage() {
  const {
    sites,
    selectedSiteId,
    selectedSite,
    loading: sitesLoading,
    setSelectedSiteId,
  } = useSites()

  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Diagnostic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [agent, setAgent] =
    useState<DiagnosticAgent | null>(null)

  const [agentLoading, setAgentLoading] =
    useState(false)

  const [agentClock, setAgentClock] =
    useState(Date.now())

  const diagnosticsForSelectedSite = selectedSiteId
    ? diagnostics.filter(
        (diagnostic) => diagnostic.siteId === selectedSiteId,
      )
    : []
  async function loadAgent(
  silent = false,
) {
  if (!selectedSiteId) {
    setAgent(null)
    return
  }

  try {
    if (!silent) {
      setAgentLoading(true)
    }

    const response = await apiFetch(
      `/devices?siteId=${selectedSiteId}`,
    )

    if (!response.ok) {
      throw new Error(
        'No se pudo consultar el agente del sitio',
      )
    }

    const data = await response.json()

    const devices =
      Array.isArray(data)
        ? data
        : []

    const diagnosticAgent =
      devices.find(
        (device: DiagnosticAgent) =>
          device.model?.type === 'AGENT',
      ) ?? null

    setAgent(diagnosticAgent)
  } catch (err) {
    console.error(
      'Error consultando agente:',
      err,
    )

    setAgent(null)
  } finally {
    if (!silent) {
      setAgentLoading(false)
    }
  }
}

  async function loadDiagnostics(silent = false) {
    try {
      if (!silent) {
        setLoading(true)
      }

      setError(null)

      const response = await apiFetch('/diagnostics')

      if (!response.ok) {
        throw new Error(
          `Error al cargar diagnósticos: ${response.status}`,
        )
      }

      const data = (await response.json()) as DiagnosticsResponse

      setDiagnostics(data)

      setSelected((current) => {
        if (!current) {
          return null
        }

        return (
          data.find(
            (diagnostic) => diagnostic.id === current.id,
          ) ?? current
        )
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible cargar los diagnósticos',
      )
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }  
 async function createDiagnostic() {
  if (!selectedSiteId) {
    setError('Selecciona un sitio antes de ejecutar un diagnóstico.')
    return
  }

  try {
    setCreating(true)
    setError(null)

    const response = await apiFetch('/diagnostics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: selectedSiteId,
      }),
    })

    if (!response.ok) {
      let message = `Error al crear diagnóstico: ${response.status}`

      try {
        const data = await response.json()

        if (data?.error) {
          message = data.error
        }
      } catch {
        // dejamos el mensaje por status
      }

      throw new Error(message)
    }

    await loadDiagnostics()
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'No fue posible crear el diagnóstico',
    )
  } finally {
    setCreating(false)
  }
}
  useEffect(() => {
    void loadDiagnostics()
  }, [])

  useEffect(() => {
  if (!selectedSiteId) {
    setAgent(null)
    return
  }

  void loadAgent()

  const intervalId =
    window.setInterval(() => {
      void loadAgent(true)
    }, 10000)

  return () => {
    window.clearInterval(intervalId)
  }
}, [selectedSiteId])

useEffect(() => {
  const intervalId =
    window.setInterval(() => {
      setAgentClock(Date.now())
    }, 10000)

  return () => {
    window.clearInterval(intervalId)
  }
}, [])

  useEffect(() => {
    const hasRunningDiagnostic =
      diagnosticsForSelectedSite.some(
        (diagnostic) => diagnostic.status === 'RUNNING',
      )

    if (!hasRunningDiagnostic) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadDiagnostics(true)
    }, 3000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [diagnosticsForSelectedSite])

  const agentOnline =
  isAgentOnline(agent)

const agentLastSeen =
  formatLastSeen(
    agent?.lastSeenAt,
  )

void agentClock

return (
  <div className="page">
    <div className="page-header diagnostics-page-header">
      <div>
        <h1>Diagnósticos</h1>

        <p>
          Estado, historial y resultados del motor de diagnóstico
          de red TECNOCOM180.
        </p>

      {selectedSite && (
  <div className="diagnostics-current-site">
    <span>Sitio actual</span>

    <strong>{selectedSite.name}</strong>

    <small>{selectedSite.code}</small>

    <div className="diagnostics-agent-status">
      <span>
        Agente NOC
      </span>

      {agentLoading ? (
        <strong>
          Consultando...
        </strong>
      ) : agent ? (
        <>
          <strong
            className={
              agentOnline
                ? 'diagnostics-agent-online'
                : 'diagnostics-agent-offline'
            }
          >
           <span className="diagnostics-agent-state">
             <span className="diagnostics-agent-dot" />
             {agentOnline ? 'Online' : 'Offline'}
           </span>
          </strong>

          <small>
            {agent.name ??
              agent.deviceCode ??
              'Agente'}
          </small>

          <small>
            {agent.ip
              ? `IP ${agent.ip}`
              : 'Sin IP registrada'}
          </small>

          <small>
            Última comunicación: {agentLastSeen}
          </small>
        </>
      ) : (
        <strong className="status-fail">
          Sin agente registrado
        </strong>
      )}
    </div>
  </div>
)}
        

      </div>

      <div className="diagnostics-header-actions">
        <select
          className="diagnostics-site-select"
          value={selectedSiteId ?? ''}
          disabled={sitesLoading}
          onChange={(event) =>
            setSelectedSiteId(event.target.value)
          }
        >
          <option value="">
            {sitesLoading
              ? 'Cargando sitios...'
              : 'Selecciona un sitio'}
          </option>

          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name} ({site.code})
            </option>
          ))}
        </select>

        <button
          type="button"
          className="button-primary"
          onClick={() => void createDiagnostic()}
          disabled={
            !selectedSiteId ||
            creating ||
            !agentOnline
          }
        >
          {creating
            ? 'Creando diagnóstico...'
            : 'Ejecutar diagnóstico'}
        </button>

        <button
          type="button"
          className="button-secondary"
          onClick={() => void loadDiagnostics()}
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>

    {error && (
      <div className="error-message">
        {error}
      </div>
    )}

      {!selectedSiteId && !sitesLoading && (
        <div className="empty-state">
          Selecciona un sitio para consultar sus diagnósticos.
        </div>
      )}

      {selectedSiteId &&
        loading &&
        diagnostics.length === 0 && (
          <div className="empty-state">
            Cargando diagnósticos...
          </div>
        )}

      {selectedSiteId &&
        !loading &&
        !error &&
        diagnosticsForSelectedSite.length === 0 && (
          <div className="empty-state">
            No existen diagnósticos registrados para este sitio.
          </div>
        )}

      {selectedSiteId &&
        !error &&
        diagnosticsForSelectedSite.length > 0 && (
          <div className="diagnostics-run-grid">
            {diagnosticsForSelectedSite.map((diagnostic) => {
              const result = diagnostic.result
              const raw = result?.rawResult

              const networkStatus =
                raw?.status ?? diagnostic.status

              const ethernet =
                raw?.speedtest?.ethernet

              const isRunning =
                diagnostic.status === 'RUNNING' &&
                !diagnostic.result

              return (
                <article
                  key={diagnostic.id}
                  className="diagnostic-run-card"
                >
                  <div className="diagnostic-run-card-header">
                    <div>
                      <span className="diagnostic-run-site-code">
                        {diagnostic.site?.code ??
                          selectedSite?.code ??
                          'SITE'}
                      </span>

                      <h2>
                        {diagnostic.site?.name ??
                          selectedSite?.name ??
                          'Diagnóstico'}
                      </h2>

                      <small>
                        {formatDate(
                          diagnostic.startedAt,
                        )}
                      </small>
                    </div>

                    <span
                      className={`diagnostic-status diagnostic-status-pill ${statusClass(
                        networkStatus,
                      )}`}
                    >
                      {statusLabel(networkStatus)}
                    </span>
                  </div>

                  {isRunning ? (
                    <div className="diagnostic-running-box">
                      <div className="diagnostic-running-indicator">
                        <span />
                      </div>

                      <div>
                        <strong>
                          Diagnóstico en ejecución
                        </strong>

                        <p>
                          Esperando resultados del agente
                          del sitio.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="diagnostic-run-metrics">
                      <div>
                        <span>Ping</span>

                        <strong>
                          {formatNumber(
                            result?.pingMs ??
                              raw?.latency?.pingMs,
                            ' ms',
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Download</span>

                        <strong>
                          {formatNumber(
                            ethernet?.downloadMbps ??
                              result?.downloadMbps,
                            ' Mbps',
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Upload</span>

                        <strong>
                          {formatNumber(
                            ethernet?.uploadMbps ??
                              result?.uploadMbps,
                            ' Mbps',
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Pérdida</span>

                        <strong>
                          {formatNumber(
                            result?.packetLoss ??
                              raw?.latency
                                ?.packetLoss,
                            ' %',
                          )}
                        </strong>
                      </div>
                    </div>
                  )}

                  {!isRunning && (
                    <div className="diagnostic-run-footer-data">
                      <span>
                        Internet:{' '}
                        <strong>
                          {result?.internet === true ||
                          raw?.internet === true
                            ? 'Sí'
                            : result?.internet ===
                                  false ||
                                raw?.internet ===
                                  false
                              ? 'No'
                              : '—'}
                        </strong>
                      </span>

                      <span>
                        Gateway:{' '}
                        <strong>
                          {result?.gateway ??
                            raw?.internetRoute
                              ?.gateway ??
                            '—'}
                        </strong>
                      </span>
                    </div>
                  )}

                  <div className="diagnostic-run-card-footer">
                    <span>
                      {diagnostic.finishedAt
                        ? `Finalizado ${formatDate(
                            diagnostic.finishedAt,
                          )}`
                        : 'Pendiente de finalización'}
                    </span>

                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        setSelected(diagnostic)
                      }
                    >
                      Ver detalle
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

      {selected && (
        <div className="diagnostic-modal-backdrop">
          <div className="diagnostic-modal diagnostic-modal-redesign">
            <div className="diagnostic-modal-header">
              <div>
                <span className="diagnostic-detail-site-code">
                  {selected.site?.code ??
                    selectedSite?.code ??
                    'SITE'}
                </span>

                <h2>
                  {selected.site?.name ??
                    selectedSite?.name ??
                    'Detalle del diagnóstico'}
                </h2>

                <p>
                  Inicio:{' '}
                  {formatDate(selected.startedAt)}
                </p>
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

              const networkStatus =
                raw?.status ?? selected.status

              const isRunning =
                selected.status === 'RUNNING' &&
                !result

              if (isRunning) {
                return (
                  <div className="diagnostic-detail-running">
                    <div className="diagnostic-running-indicator large">
                      <span />
                    </div>

                    <h3>
                      Diagnóstico en ejecución
                    </h3>

                    <p>
                      El diagnóstico fue registrado y se
                      encuentra esperando resultados del
                      agente asociado al sitio.
                    </p>

                    <div className="diagnostic-running-info">
                      <div>
                        <span>Estado</span>

                        <strong>Ejecutando</strong>
                      </div>

                      <div>
                        <span>Inicio</span>

                        <strong>
                          {formatDate(
                            selected.startedAt,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Sitio</span>

                        <strong>
                          {selected.site?.name ??
                            selectedSite?.name ??
                            '—'}
                        </strong>
                      </div>
                    </div>

                    <details className="diagnostic-technical-details">
                      <summary>
                        Datos técnicos
                      </summary>

                      <div className="diagnostic-technical-id">
                        <span>Diagnostic ID</span>
                        <code>{selected.id}</code>
                      </div>
                    </details>
                  </div>
                )
              }

              const summary = raw?.summary
              const findings = raw?.findings ?? []
              const route = raw?.internetRoute
              const latency = raw?.latency
              const dns = raw?.dns
              const wifi = raw?.wifi

              const ethernetSpeed =
                raw?.speedtest?.ethernet

              const wifiSpeed =
                raw?.speedtest?.wifi

              return (
                <div className="diagnostic-detail-content">
                  <section className="diagnostic-topic-card diagnostic-topic-overview">
                    <div className="diagnostic-topic-header">
                      <div>
                        <span>Resumen</span>
                        <h3>Estado general</h3>
                      </div>

                      <strong
                        className={`diagnostic-status diagnostic-status-pill ${statusClass(
                          networkStatus,
                        )}`}
                      >
                        {statusLabel(
                          networkStatus,
                        )}
                      </strong>
                    </div>

                    <div className="diagnostic-summary-grid">
                      <SummaryCard
                        label="PASS"
                        value={
                          summary?.pass ?? 0
                        }
                        className="summary-pass"
                      />

                      <SummaryCard
                        label="WARNING"
                        value={
                          summary?.warning ?? 0
                        }
                        className="summary-warning"
                      />

                      <SummaryCard
                        label="FAIL"
                        value={
                          summary?.fail ?? 0
                        }
                        className="summary-fail"
                      />

                      <SummaryCard
                        label="SKIP"
                        value={
                          summary?.skip ?? 0
                        }
                        className="summary-skip"
                      />
                    </div>
                  </section>
                  
                                    {findings.length > 0 && (
                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Hallazgos</span>
                          <h3>
                            Advertencias y problemas detectados
                          </h3>
                        </div>
                      </div>

                      <div className="diagnostic-findings">
                        {findings.map((finding, index) => (
                          <div
                            key={`${finding.severity}-${index}`}
                            className={`diagnostic-finding ${statusClass(
                              finding.severity,
                            )}`}
                          >
                            <strong>
                              {finding.severity === 'WARNING'
                                ? 'Advertencia'
                                : finding.severity === 'FAIL'
                                  ? 'Fallo'
                                  : 'Omitido'}
                            </strong>

                            <span>{finding.message}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="diagnostic-topic-grid">
                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Red</span>
                          <h3>Conectividad</h3>
                        </div>
                      </div>

                      <div className="diagnostic-detail-grid">
                        <MetricCard
                          label="Internet"
                          value={
                            raw?.internet === true
                              ? 'Sí'
                              : raw?.internet ===
                                  false
                                ? 'No'
                                : result
                                      ?.internet ===
                                    true
                                  ? 'Sí'
                                  : result
                                        ?.internet ===
                                      false
                                    ? 'No'
                                    : '—'
                          }
                        />

                        <MetricCard
                          label="Interfaz"
                          value={
                            route?.interface ??
                            '—'
                          }
                        />

                        <MetricCard
                          label="IP origen"
                          value={
                            route?.sourceIp ??
                            '—'
                          }
                        />

                        <MetricCard
                          label="Gateway"
                          value={
                            route?.gateway ??
                            result?.gateway ??
                            '—'
                          }
                        />
                      </div>
                    </section>

                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Calidad</span>
                          <h3>
                            Latencia y pérdida
                          </h3>
                        </div>
                      </div>

                      <div className="diagnostic-detail-grid">
                        <MetricCard
                          label="Ping"
                          value={formatNumber(
                            latency?.pingMs ??
                              result?.pingMs,
                            ' ms',
                          )}
                        />

                        <MetricCard
                          label="Pérdida"
                          value={formatNumber(
                            latency?.packetLoss ??
                              result?.packetLoss,
                            ' %',
                          )}
                        />
                      </div>
                    </section>

                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Internet</span>
                          <h3>
                            Speedtest Ethernet
                          </h3>
                        </div>
                      </div>

                      <div className="diagnostic-detail-grid">
                        <MetricCard
                          label="Interfaz"
                          value={
                            ethernetSpeed
                              ?.interface ??
                            '—'
                          }
                        />

                        <MetricCard
                          label="Download"
                          value={formatNumber(
                            ethernetSpeed
                              ?.downloadMbps ??
                              result
                                ?.downloadMbps,
                            ' Mbps',
                          )}
                        />

                        <MetricCard
                          label="Upload"
                          value={formatNumber(
                            ethernetSpeed
                              ?.uploadMbps ??
                              result
                                ?.uploadMbps,
                            ' Mbps',
                          )}
                        />

                        <MetricCard
                          label="Latencia"
                          value={formatNumber(
                            ethernetSpeed
                              ?.latencyMs,
                            ' ms',
                          )}
                        />

                        <MetricCard
                          label="Jitter"
                          value={formatNumber(
                            ethernetSpeed
                              ?.jitterMs,
                            ' ms',
                          )}
                        />

                        <MetricCard
                          label="Pérdida"
                          value={formatNumber(
                            ethernetSpeed
                              ?.packetLoss,
                            ' %',
                          )}
                        />

                        <MetricCard
                          label="Servidor"
                          value={
                            ethernetSpeed
                              ?.server ??
                            '—'
                          }
                        />
                      </div>
                    </section>

                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Wireless</span>
                          <h3>WiFi</h3>
                        </div>
                      </div>

                      <div className="diagnostic-detail-grid">
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
                          label="Señal"
                          value={formatNumber(
                            wifi?.signalDbm,
                            ' dBm',
                          )}
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

                        <MetricCard
                          label="Download"
                          value={formatNumber(
                            wifiSpeed
                              ?.downloadMbps,
                            ' Mbps',
                          )}
                        />

                        <MetricCard
                          label="Upload"
                          value={formatNumber(
                            wifiSpeed
                              ?.uploadMbps,
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
                      </div>
                    </section>

                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Resolución</span>
                          <h3>DNS</h3>
                        </div>
                      </div>

                      <div className="diagnostic-detail-grid">
                        <MetricCard
                          label="Servidores"
                          value={
                            dns?.servers?.join(
                              ', ',
                            ) ??
                            result?.dns ??
                            '—'
                          }
                        />

                        <MetricCard
                          label="Operativo"
                          value={
                            dns?.operational ===
                            true
                              ? 'Sí'
                              : dns?.operational ===
                                  false
                                ? 'No'
                                : '—'
                          }
                        />
                      </div>
                    </section>

                    <section className="diagnostic-topic-card">
                      <div className="diagnostic-topic-header">
                        <div>
                          <span>Ejecución</span>
                          <h3>Tiempos</h3>
                        </div>
                      </div>

                      <div className="diagnostic-detail-grid">
                        <MetricCard
                          label="Inicio"
                          value={formatDate(
                            selected.startedAt,
                          )}
                        />

                        <MetricCard
                          label="Fin"
                          value={formatDate(
                            selected.finishedAt,
                          )}
                        />
                      </div>
                    </section>
                  </div>

                  <details className="diagnostic-technical-details">
                    <summary>
                      Datos técnicos / JSON
                    </summary>

                    <div className="diagnostic-technical-id">
                      <span>Diagnostic ID</span>

                      <code>
                        {selected.id}
                      </code>
                    </div>

                    <div className="diagnostic-technical-id">
                      <span>Site ID</span>

                      <code>
                        {selected.siteId ?? '—'}
                      </code>
                    </div>

                    <pre className="diagnostic-json">
                      {JSON.stringify(
                        raw ?? result,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}