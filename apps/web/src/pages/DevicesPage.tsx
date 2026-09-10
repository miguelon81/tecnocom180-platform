import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { apiFetch } from '../api/client'
import { getSites } from '../api/sites'
import { getAreas } from '../api/areas'
import { getBrands } from '../api/brands'
import { getModels } from '../api/models'

import {
  getLatestTelemetry,
  getTelemetry,
} from '../api/telemetry'

import type {
  DeviceTelemetry,
} from '../api/telemetry'

import type { Site, Area } from '../types/site'
import type { Brand } from '../api/brands'
import type { DeviceModel } from '../api/models'

import { useAuth } from '../auth/AuthContext'

type Device = {
  id: string
  deviceCode?: string | null
  siteId: string
  areaId?: string | null
  modelId: string
  name?: string | null
  hostname?: string | null
  serial?: string | null
  ip?: string | null
  mac?: string | null
  firmware?: string | null
  online: boolean
  lastSeenAt?: string | null
  installedAt?: string | null
  notes?: string | null
  site?: {
    id: string
    name: string
  } | null
  area?: {
    id: string
    name: string
  } | null
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

type DeviceForm = {
  siteId: string
  areaId: string
  brandId: string
  modelId: string
  name: string
  hostname: string
  serial: string
  ip: string
  mac: string
  firmware: string
  installedAt: string
  notes: string
}

const emptyForm: DeviceForm = {
  siteId: '',
  areaId: '',
  brandId: '',
  modelId: '',
  name: '',
  hostname: '',
  serial: '',
  ip: '',
  mac: '',
  firmware: '',
  installedAt: '',
  notes: '',
}

function formatTelemetryDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-MX')
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }

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
  if (value === null || value === undefined) {
    return '—'
  }

  return `${value}${suffix}`
}

function DevicesPage() {
  const { user } = useAuth()

  const canManageDevices =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'OPERATIONS' ||
    user?.role === 'ORG_ADMIN'

  const [devices, setDevices] = useState<Device[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [formAreas, setFormAreas] = useState<Area[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])

  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')

  const [selectedTelemetryDeviceId, setSelectedTelemetryDeviceId] =
    useState<string | null>(null)

  const [selectedTelemetry, setSelectedTelemetry] =
    useState<DeviceTelemetry | null>(null)

  const [telemetryHistory, setTelemetryHistory] =
    useState<DeviceTelemetry[]>([])

  const [telemetryLoading, setTelemetryLoading] =
    useState(false)

  const [telemetryError, setTelemetryError] =
    useState<string | null>(null)

const [iotTelemetry, setIotTelemetry] =
  useState<Record<string, DeviceTelemetry | null>>({})

const [iotTelemetryLoading, setIotTelemetryLoading] =
  useState<Record<string, boolean>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingDevice, setEditingDevice] =
    useState<Device | null>(null)

  const [form, setForm] =
    useState<DeviceForm>(emptyForm)

  async function loadDevices(silent = false) {
  try {
    if (!silent) {
      setLoading(true)
    }

    setError(null)

    const query = new URLSearchParams()

    if (selectedSiteId) {
      query.set('siteId', selectedSiteId)
    }

    if (selectedAreaId) {
      query.set('areaId', selectedAreaId)
    }

    const suffix = query.toString()
      ? `?${query.toString()}`
      : ''

    const response = await apiFetch(
      `/devices${suffix}`,
    )

    if (!response.ok) {
      throw new Error(
        'No se pudieron cargar los dispositivos',
      )
    }

    const data = await response.json()

    setDevices(
      Array.isArray(data)
        ? data
        : [],
    )
  } catch (err) {
    console.error(err)

    setError(
      err instanceof Error
        ? err.message
        : 'No se pudieron cargar los dispositivos',
    )
  } finally {
    if (!silent) {
      setLoading(false)
    }
  }
}

  async function initialize() {
    try {
      setLoading(true)
      setError(null)

      const [
        siteData,
        brandData,
        modelData,
      ] = await Promise.all([
        getSites(),
        getBrands(),
        getModels(),
      ])

      setSites(siteData)
      setBrands(brandData)
      setModels(modelData)

      if (siteData.length > 0) {
        const firstSiteId =
          siteData[0].id

        setSelectedSiteId(
          firstSiteId,
        )

        const areaData =
          await getAreas(
            firstSiteId,
          )

        setAreas(areaData)
      } else {
        setAreas([])
      }
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Error al inicializar dispositivos',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!selectedSiteId) {
      setAreas([])
      setSelectedAreaId('')
      return
    }

    async function loadSiteAreas() {
      try {
        const data =
          await getAreas(
            selectedSiteId,
          )

        setAreas(data)

        setSelectedAreaId(
          (current) =>
            data.some(
              (area) =>
                area.id === current,
            )
              ? current
              : '',
        )
      } catch (err) {
        console.error(err)

        setAreas([])
        setSelectedAreaId('')
      }
    }

    loadSiteAreas()
  }, [selectedSiteId])

  useEffect(() => {
    if (!form.siteId) {
      setFormAreas([])
      return
    }

    async function loadFormAreas() {
      try {
        const data =
          await getAreas(
            form.siteId,
          )

        setFormAreas(data)

        setForm((current) => ({
          ...current,
          areaId: data.some(
            (area) =>
              area.id === current.areaId,
          )
            ? current.areaId
            : '',
        }))
      } catch (err) {
        console.error(err)
        setFormAreas([])
      }
    }

    loadFormAreas()
  }, [form.siteId])

  useEffect(() => {
    if (sites.length === 0) {
      return
    }

    loadDevices()
  }, [
    selectedSiteId,
    selectedAreaId,
  ])

  useEffect(() => {
  if (!selectedSiteId) {
    return
  }

  const interval = window.setInterval(() => {
    void loadDevices(true)
  }, 10000)

  return () => {
    window.clearInterval(interval)
  }
}, [
  selectedSiteId,
  selectedAreaId,
])


function isIotDevice(device: Device) {
  return device.model?.type === 'IOT'
}

function isAgentDevice(device: Device) {
  return device.model?.type === 'AGENT'
}

const AGENT_STALE_MS = 90 * 1000
const IOT_STALE_MS = 5 * 60 * 60 * 1000

function isRecentDate(
  value: string | null | undefined,
  maxAgeMs: number,
) {
  if (!value) {
    return false
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return false
  }

  return Date.now() - timestamp <= maxAgeMs
}

function isDeviceEffectivelyOnline(
  device: Device,
  telemetry?: DeviceTelemetry | null,
) {
  if (isAgentDevice(device)) {
    return (
      device.online &&
      isRecentDate(
        device.lastSeenAt,
        AGENT_STALE_MS,
      )
    )
  }

  if (isIotDevice(device)) {
    const lastCommunication =
      device.lastSeenAt ??
      telemetry?.createdAt

    return isRecentDate(
      lastCommunication,
      IOT_STALE_MS,
    )
  }

  return device.online
}

useEffect(() => {
  let cancelled = false

  async function loadLatestIotTelemetry() {
    const iotDevices = devices.filter(isIotDevice)

    if (iotDevices.length === 0) {
      if (!cancelled) {
        setIotTelemetry({})
        setIotTelemetryLoading({})
      }
      return
    }

    for (const device of iotDevices) {
      try {
        setIotTelemetryLoading((current) => ({
          ...current,
          [device.id]: true,
        }))

        const latest =
          await getLatestTelemetry(device.id)

        if (!cancelled) {
          setIotTelemetry((current) => ({
            ...current,
            [device.id]:
              latest.telemetry ?? null,
          }))
        }
      } catch (err) {
        console.error(
          `Error cargando telemetría IoT ${device.id}:`,
          err,
        )

        if (!cancelled) {
          setIotTelemetry((current) => ({
            ...current,
            [device.id]: null,
          }))
        }
      } finally {
        if (!cancelled) {
          setIotTelemetryLoading((current) => ({
            ...current,
            [device.id]: false,
          }))
        }
      }
    }
  }

  loadLatestIotTelemetry()

  const interval = window.setInterval(() => {
    loadLatestIotTelemetry()
  }, 10000)

  return () => {
    cancelled = true
    window.clearInterval(interval)
  }
}, [devices])

  async function refreshTelemetry(
    deviceId: string,
  ) {
    try {
      const [
        latest,
        history,
      ] = await Promise.all([
        getLatestTelemetry(deviceId),
        getTelemetry(deviceId),
      ])

      setSelectedTelemetry(
        latest.telemetry ?? null,
      )

      setTelemetryHistory(
        Array.isArray(history.telemetry)
          ? history.telemetry
          : [],
      )

      setTelemetryError(null)
    } catch (err) {
      console.error(
        'Error actualizando telemetría:',
        err,
      )

      setTelemetryError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la telemetría',
      )
    }
  }

  async function loadLatestTelemetry(
    deviceId: string,
  ) {
    try {
      setTelemetryLoading(true)
      setTelemetryError(null)
      setSelectedTelemetryDeviceId(
        deviceId,
      )

      await refreshTelemetry(
        deviceId,
      )
    } catch (err) {
      console.error(err)

      setSelectedTelemetry(null)
      setTelemetryHistory([])

      setTelemetryError(
        err instanceof Error
          ? err.message
          : 'No se pudo consultar la telemetría',
      )
    } finally {
      setTelemetryLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedTelemetryDeviceId) {
      return
    }

    const interval =
      window.setInterval(() => {
        refreshTelemetry(
          selectedTelemetryDeviceId,
        )
      }, 10000)

    return () => {
      window.clearInterval(
        interval,
      )
    }
  }, [
    selectedTelemetryDeviceId,
  ])

  function closeTelemetry() {
    setSelectedTelemetryDeviceId(
      null,
    )

    setSelectedTelemetry(null)
    setTelemetryHistory([])
    setTelemetryError(null)
  }

  function handleFormChange(
    field: keyof DeviceForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function openCreateForm() {
    if (!canManageDevices) {
      return
    }

    setEditingDevice(null)

    setForm({
      ...emptyForm,
      siteId: selectedSiteId,
    })

    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(
    device: Device,
  ) {
    if (!canManageDevices) {
      return
    }

    const brandId =
      device.model?.brand?.id ?? ''

    setEditingDevice(device)

    setForm({
      siteId: device.siteId,
      areaId:
        device.areaId ?? '',
      brandId,
      modelId: device.modelId,
      name:
        device.name ?? '',
      hostname:
        device.hostname ?? '',
      serial:
        device.serial ?? '',
      ip:
        device.ip ?? '',
      mac:
        device.mac ?? '',
      firmware:
        device.firmware ?? '',
      installedAt:
        device.installedAt
          ? device.installedAt.slice(0, 10)
          : '',
      notes:
        device.notes ?? '',
    })

    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingDevice(null)
    setForm(emptyForm)
    setFormAreas([])
    setFormError(null)
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!canManageDevices) {
      setFormError(
        'No tienes permisos para modificar dispositivos',
      )
      return
    }

    if (!form.siteId) {
      setFormError(
        'El sitio es obligatorio',
      )
      return
    }

    if (!form.modelId) {
      setFormError(
        'El modelo es obligatorio',
      )
      return
    }

    try {
      setSaving(true)
      setFormError(null)

      const body = {
        siteId: form.siteId,
        areaId:
          form.areaId || null,
        modelId: form.modelId,
        name:
          form.name.trim() ||
          null,
        hostname:
          form.hostname.trim() ||
          null,
        serial:
          form.serial.trim() ||
          null,
        ip:
          form.ip.trim() ||
          null,
        mac:
          form.mac.trim() ||
          null,
        firmware:
          form.firmware.trim() ||
          null,
        installedAt:
          form.installedAt
            ? new Date(
                `${form.installedAt}T12:00:00`,
              ).toISOString()
            : null,
        notes:
          form.notes.trim() ||
          null,
      }

      if (editingDevice) {
        const response =
          await apiFetch(
            `/devices/${editingDevice.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(
                body,
              ),
            },
          )

        if (!response.ok) {
          const data =
            await response
              .json()
              .catch(() => null)

          throw new Error(
            data?.error ??
              'No se pudo actualizar el dispositivo',
          )
        }
      } else {
        const response =
          await apiFetch(
            '/devices',
            {
              method: 'POST',
              body: JSON.stringify(
                body,
              ),
            },
          )

        if (!response.ok) {
          const data =
            await response
              .json()
              .catch(() => null)

          throw new Error(
            data?.error ??
              'No se pudo crear el dispositivo',
          )
        }
      }

      closeForm()
      await loadDevices()
    } catch (err) {
      console.error(err)

      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el dispositivo',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(
    device: Device,
  ) {
    if (!canManageDevices) {
      return
    }

    const name =
      device.name ??
      device.hostname ??
      device.deviceCode ??
      device.serial ??
      device.id

    const confirmed =
      window.confirm(
        `¿Seguro que deseas eliminar el dispositivo "${name}"?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      const response =
        await apiFetch(
          `/devices/${device.id}`,
          {
            method: 'DELETE',
          },
        )

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => null)

        throw new Error(
          data?.error ??
            'No se pudo eliminar el dispositivo',
        )
      }

      if (
        selectedTelemetryDeviceId ===
        device.id
      ) {
        closeTelemetry()
      }

      await loadDevices()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Error al eliminar el dispositivo',
      )
    }
  }

  const availableModels =
    form.brandId
      ? models.filter(
          (model) =>
            model.brandId ===
            form.brandId,
        )
      : []

  const telemetryPoints =
    [...telemetryHistory]
      .filter(
        (item) =>
          item.nivel !== null,
      )
      .reverse()

  const chartWidth = 700
  const chartHeight = 280
  const chartPadding = 40

  const chartMax = 100
  const chartMin = 0

  const chartXStep =
    telemetryPoints.length > 1
      ? (chartWidth -
          chartPadding * 2) /
        (telemetryPoints.length - 1)
      : 0

  const chartYRange =
    chartMax - chartMin

  const chartCoordinates =
    telemetryPoints.map(
      (item, index) => {
        const value =
          item.nivel ?? 0

        const x =
          chartPadding +
          index * chartXStep

        const y =
          chartHeight -
          chartPadding -
          ((value - chartMin) /
            chartYRange) *
            (chartHeight -
              chartPadding * 2)

        return {
          x,
          y,
          value,
          item,
        }
      },
    )

  const chartPolyline =
    chartCoordinates
      .map(
        (point) =>
          `${point.x},${point.y}`,
      )
      .join(' ')
function getDeviceTitle(device: Device) {
  return (
    device.name ||
    device.hostname ||
    device.deviceCode ||
    device.serial ||
    'Dispositivo'
  )
}

function getDeviceModel(device: Device) {
  const brand =
    device.model?.brand?.name

  const model =
    device.model?.name

  if (brand && model) {
    return `${brand} ${model}`
  }

  return model || brand || 'Sin modelo'
}

function getSignalLabel(
  value: number | null | undefined,
) {
  if (value === null || value === undefined) {
    return 'Sin datos'
  }

  if (value >= -50) {
    return 'Excelente'
  }

  if (value >= -67) {
    return 'Buena'
  }

  if (value >= -75) {
    return 'Regular'
  }

  return 'Débil'
}

function getBatteryLabel(
  value: number | null | undefined,
) {
  if (value === null || value === undefined) {
    return 'Sin datos'
  }

  if (value <= 20) {
    return 'Baja'
  }

  if (value <= 50) {
    return 'Media'
  }

  return 'Buena'
}

function getLevelClass(
  value: number | null | undefined,
) {
  if (value === null || value === undefined) {
    return 'device-tank-empty'
  }

  if (value <= 23) {
    return 'device-tank-critical'
  }

  if (value <= 31) {
    return 'device-tank-warning'
  }

  return 'device-tank-normal'
}

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>
            Dispositivos
          </h1>

          <p>
            Inventario de infraestructura
            tecnológica de los sitios.
          </p>
        </div>

        <div className="site-count">
          {devices.length}{' '}
          {devices.length === 1
            ? 'dispositivo'
            : 'dispositivos'}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {sites.length > 0 && (
        <section
          className="card"
          style={{
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'end',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <label>
              Sitio

              <select
                value={
                  selectedSiteId
                }
                onChange={(event) =>
                  setSelectedSiteId(
                    event.target.value,
                  )
                }
              >
                {sites.map(
                  (site) => (
                    <option
                      key={site.id}
                      value={site.id}
                    >
                      {site.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Área

              <select
                value={
                  selectedAreaId
                }
                onChange={(event) =>
                  setSelectedAreaId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Todas las áreas
                </option>

                {areas.map(
                  (area) => (
                    <option
                      key={area.id}
                      value={area.id}
                    >
                      {area.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            {canManageDevices && (
              <button
                type="button"
                onClick={
                  openCreateForm
                }
              >
                + Nuevo dispositivo
              </button>
            )}
          </div>
        </section>
      )}

      {showForm && canManageDevices && (
        <section
          className="card"
          style={{
            marginBottom: '24px',
          }}
        >
          <p className="eyebrow">
            {editingDevice
              ? 'EDITAR DISPOSITIVO'
              : 'NUEVO DISPOSITIVO'}
          </p>

          <h2>
            {editingDevice
              ? editingDevice.name ??
                editingDevice.hostname ??
                editingDevice.deviceCode ??
                editingDevice.serial ??
                'Dispositivo'
              : 'Registrar dispositivo'}
          </h2>

          {formError && (
            <div className="error-message">
              {formError}
            </div>
          )}

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <label>
                Sitio

                <select
                  value={
                    form.siteId
                  }
                  onChange={(event) => {
                    handleFormChange(
                      'siteId',
                      event.target.value,
                    )

                    handleFormChange(
                      'areaId',
                      '',
                    )
                  }}
                >
                  <option value="">
                    Selecciona un sitio
                  </option>

                  {sites.map(
                    (site) => (
                      <option
                        key={site.id}
                        value={site.id}
                      >
                        {site.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Área

                <select
                  value={
                    form.areaId
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'areaId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Sin área
                  </option>

                  {formAreas.map(
                    (area) => (
                      <option
                        key={area.id}
                        value={area.id}
                      >
                        {area.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Marca

                <select
                  value={
                    form.brandId
                  }
                  onChange={(event) => {
                    handleFormChange(
                      'brandId',
                      event.target.value,
                    )

                    handleFormChange(
                      'modelId',
                      '',
                    )
                  }}
                >
                  <option value="">
                    Selecciona una marca
                  </option>

                  {brands.map(
                    (brand) => (
                      <option
                        key={brand.id}
                        value={brand.id}
                      >
                        {brand.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Modelo

                <select
                  value={
                    form.modelId
                  }
                  disabled={
                    !form.brandId
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'modelId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Selecciona un modelo
                  </option>

                  {availableModels.map(
                    (model) => (
                      <option
                        key={model.id}
                        value={model.id}
                      >
                        {model.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Nombre

                <input
                  type="text"
                  value={
                    form.name
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'name',
                      event.target.value,
                    )
                  }
                  placeholder="AP Lobby"
                />
              </label>

              <label>
                Hostname

                <input
                  type="text"
                  value={
                    form.hostname
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'hostname',
                      event.target.value,
                    )
                  }
                  placeholder="AP-LOBBY-01"
                />
              </label>

              <label>
                IP

                <input
                  type="text"
                  value={form.ip}
                  onChange={(event) =>
                    handleFormChange(
                      'ip',
                      event.target.value,
                    )
                  }
                  placeholder="192.168.1.10"
                />
              </label>

              <label>
                MAC

                <input
                  type="text"
                  value={form.mac}
                  onChange={(event) =>
                    handleFormChange(
                      'mac',
                      event.target.value,
                    )
                  }
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
              </label>

              <label>
                Serial

                <input
                  type="text"
                  value={
                    form.serial
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'serial',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Firmware

                <input
                  type="text"
                  value={
                    form.firmware
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'firmware',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Fecha de instalación

                <input
                  type="date"
                  value={
                    form.installedAt
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'installedAt',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label
                style={{
                  gridColumn:
                    '1 / -1',
                }}
              >
                Notas

                <textarea
                  value={
                    form.notes
                  }
                  onChange={(event) =>
                    handleFormChange(
                      'notes',
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Observaciones, ubicación física, puertos, configuración, etc."
                />
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '20px',
              }}
            >
              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Guardando...'
                  : editingDevice
                    ? 'Guardar cambios'
                    : 'Crear dispositivo'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={
                  closeForm
                }
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {selectedTelemetryDeviceId && (
        <section
          className="card"
          style={{
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p className="eyebrow">
                TELEMETRÍA
              </p>

              <h2>
                {devices.find(
                  (device) =>
                    device.id ===
                    selectedTelemetryDeviceId,
                )?.name ??
                  devices.find(
                    (device) =>
                      device.id ===
                      selectedTelemetryDeviceId,
                  )?.deviceCode ??
                  'Dispositivo'}
              </h2>
            </div>

            <button
              type="button"
              onClick={
                closeTelemetry
              }
            >
              Cerrar
            </button>
          </div>

          {telemetryLoading && (
            <p>
              Consultando última
              telemetría...
            </p>
          )}

          {telemetryError && (
            <div className="error-message">
              {telemetryError}
            </div>
          )}

          {selectedTelemetry &&
            !telemetryLoading && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '16px',
                    marginTop: '20px',
                  }}
                >
                  <div className="card">
                    <p className="eyebrow">
                      NIVEL
                    </p>

                    <h2>
                      {formatNumber(
                        selectedTelemetry.nivel,
                        '%',
                      )}
                    </h2>
                  </div>

                  <div className="card">
                    <p className="eyebrow">
                      BATERÍA
                    </p>

                    <h2>
                      {formatNumber(
                        selectedTelemetry.bateria,
                        '%',
                      )}
                    </h2>
                  </div>

                  <div className="card">
                    <p className="eyebrow">
                      SEÑAL
                    </p>

                    <h2>
                      {formatNumber(
                        selectedTelemetry.senal,
                        ' dBm',
                      )}
                    </h2>
                  </div>

                  <div className="card">
                    <p className="eyebrow">
                      RECARGA
                    </p>

                    <h2>
                      {formatNumber(
                        selectedTelemetry.recarga,
                      )}
                    </h2>
                  </div>

                  <div className="card">
                    <p className="eyebrow">
                      CONSUMO
                    </p>

                    <h2>
                      {formatNumber(
                        selectedTelemetry.consumo,
                      )}
                    </h2>
                  </div>

                  <div className="card">
                    <p className="eyebrow">
                      RELAY 1
                    </p>

                    <h2>
                      {selectedTelemetry.relay1 ===
                      1
                        ? 'ON'
                        : selectedTelemetry.relay1 ===
                            0
                          ? 'OFF'
                          : '—'}
                    </h2>
                  </div>
                </div>

                {telemetryPoints.length > 0 && (
                  <div
                    className="card"
                    style={{
                      marginTop: '24px',
                    }}
                  >
                    <p className="eyebrow">
                      HISTORIAL
                    </p>

                    <h3>
                      Nivel de cisterna
                    </h3>

                    <div
                      style={{
                        width: '100%',
                        overflowX:
                          'auto',
                        marginTop:
                          '16px',
                      }}
                    >
                      <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        width="100%"
                        height="280"
                        role="img"
                        aria-label="Historial del nivel de la cisterna"
                      >
                        <line
                          x1={
                            chartPadding
                          }
                          y1={
                            chartHeight -
                            chartPadding
                          }
                          x2={
                            chartWidth -
                            chartPadding
                          }
                          y2={
                            chartHeight -
                            chartPadding
                          }
                          stroke="currentColor"
                          opacity="0.25"
                        />

                        <line
                          x1={
                            chartPadding
                          }
                          y1={
                            chartPadding
                          }
                          x2={
                            chartPadding
                          }
                          y2={
                            chartHeight -
                            chartPadding
                          }
                          stroke="currentColor"
                          opacity="0.25"
                        />

                        <text
                          x="8"
                          y={
                            chartPadding +
                            5
                          }
                          fontSize="12"
                          opacity="0.7"
                        >
                          100%
                        </text>

                        <text
                          x="8"
                          y={
                            chartHeight -
                            chartPadding +
                            5
                          }
                          fontSize="12"
                          opacity="0.7"
                        >
                          0%
                        </text>

                        {chartCoordinates.length >
                          1 && (
                          <polyline
                            points={
                              chartPolyline
                            }
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                        )}

                        {chartCoordinates.map(
                          (point) => (
                            <circle
                              key={
                                point.item.id
                              }
                              cx={
                                point.x
                              }
                              cy={
                                point.y
                              }
                              r="5"
                              fill="currentColor"
                            >
                              <title>
                                {point.value}
                                % —{' '}
                                {formatTelemetryDate(
                                  point
                                    .item
                                    .createdAt,
                                )}
                              </title>
                            </circle>
                          ),
                        )}

                        {chartCoordinates.length >
                          0 && (
                          <>
                            <text
                              x={
                                chartCoordinates[0]
                                  .x
                              }
                              y={
                                chartHeight -
                                12
                              }
                              fontSize="11"
                              textAnchor="middle"
                              opacity="0.7"
                            >
                              {formatTelemetryDate(
                                chartCoordinates[0]
                                  .item
                                  .createdAt,
                              )}
                            </text>

                            <text
                              x={
                                chartCoordinates[
                                  chartCoordinates.length -
                                    1
                                ].x
                              }
                              y={
                                chartHeight -
                                12
                              }
                              fontSize="11"
                              textAnchor="middle"
                              opacity="0.7"
                            >
                              {formatTelemetryDate(
                                chartCoordinates[
                                  chartCoordinates.length -
                                    1
                                ].item
                                  .createdAt,
                              )}
                            </text>
                          </>
                        )}
                      </svg>
                    </div>

                    <p
                      style={{
                        marginTop:
                          '8px',
                        opacity: 0.7,
                      }}
                    >
                      {telemetryPoints.length}{' '}
                      {telemetryPoints.length ===
                      1
                        ? 'lectura'
                        : 'lecturas'}{' '}
                      registradas
                    </p>
                  </div>
                )}

                <p
                  style={{
                    marginTop: '16px',
                    opacity: 0.7,
                  }}
                >
                  Última lectura:{' '}
                  {formatTelemetryDate(
                    selectedTelemetry.createdAt,
                  )}
                </p>

                <p
                  style={{
                    marginTop: '4px',
                    opacity: 0.6,
                    fontSize: '0.9rem',
                  }}
                >
                  Actualización automática
                  cada 10 segundos.
                </p>
              </>
            )}
        </section>
      )}

      {loading ? (
        <p>
          Cargando dispositivos...
        </p>
      ) : sites.length === 0 ? (
        <section className="card">
          <h2>
            No hay sitios registrados
          </h2>

          <p>
            Primero debes registrar un
            sitio para poder crear
            dispositivos.
          </p>
        </section>
      ) : devices.length === 0 ? (
        <section className="card">
          <h2>
            No hay dispositivos registrados
          </h2>

          <p>
            No existen dispositivos
            para el sitio y área
            seleccionados.
          </p>
        </section>
      ) : (
       <div className="devices-grid">
  {devices.map((device) => {
  const isIot =
    isIotDevice(device)

  const telemetry =
    iotTelemetry[device.id]

  const telemetryIsLoading =
    iotTelemetryLoading[device.id]

  if (isIot) {
    const effectivelyOnline =
      isDeviceEffectivelyOnline(
        device,
        telemetry,
      )

    const level =
      telemetry?.nivel ?? null

    const safeLevel =
      level === null
        ? 0
        : Math.max(
            0,
            Math.min(100, level),
          )

      return (
        <article
          key={device.id}
          className="device-card device-card-iot"
        >
          <div className="device-card-header">
            <div>
              <div className="device-type-label">
                IoT · Sensor
              </div>

              <h2>
                {getDeviceTitle(device)}
              </h2>

              <p>
                {device.deviceCode ?? 'Sin código'}
              </p>
            </div>

            <span
  className={
    effectivelyOnline
      ? 'device-online-badge device-online'
      : 'device-online-badge device-offline'
  }
>
  <span />
  {effectivelyOnline
    ? 'Online'
    : 'Offline'}
</span>
          </div>

          <div className="device-location">
            <span>
              {device.site?.name ?? 'Sin sitio'}
            </span>

            <strong>·</strong>

            <span>
              {device.area?.name ?? 'Sin área'}
            </span>
          </div>

          {telemetryIsLoading ? (
            <div className="device-widget-loading">
              Consultando sensor...
            </div>
          ) : telemetry ? (
            <>
              <div className="device-iot-main">
                <div className="device-tank-wrap">
                  <div
                    className={`device-tank ${getLevelClass(
                      level,
                    )}`}
                  >
                    <div
                      className="device-tank-liquid"
                      style={{
                        height: `${safeLevel}%`,
                      }}
                    />

                    <div className="device-tank-value">
                      <strong>
                        {formatNumber(
                          level,
                          '%',
                        )}
                      </strong>

                      <span>Nivel</span>
                    </div>
                  </div>
                </div>

                <div className="device-iot-summary">
                  <span>
                    Nivel actual
                  </span>

                  <strong>
                    {formatNumber(
                      level,
                      '%',
                    )}
                  </strong>

                  <small>
                    Última lectura:{' '}
                    {formatTelemetryDate(
                      telemetry.createdAt,
                    )}
                  </small>
                </div>
              </div>

              <div className="device-metrics-grid">
                <div className="device-metric">
                  <span className="device-metric-icon">
                    🔋
                  </span>

                  <div>
                    <span>Batería</span>

                    <strong>
                      {formatNumber(
                        telemetry.bateria,
                        '%',
                      )}
                    </strong>

                    <small>
                      {getBatteryLabel(
                        telemetry.bateria,
                      )}
                    </small>
                  </div>
                </div>

                <div className="device-metric">
                  <span className="device-metric-icon">
                    📶
                  </span>

                  <div>
                    <span>Señal</span>

                    <strong>
                      {formatNumber(
                        telemetry.senal,
                        ' dBm',
                      )}
                    </strong>

                    <small>
                      {getSignalLabel(
                        telemetry.senal,
                      )}
                    </small>
                  </div>
                </div>

                <div className="device-metric">
                  <span className="device-metric-icon">
                    ↗
                  </span>

                  <div>
                    <span>Recarga</span>

                    <strong>
                      {formatNumber(
                        telemetry.recarga,
                        '%',
                      )}
                    </strong>
                  </div>
                </div>

                <div className="device-metric">
                  <span className="device-metric-icon">
                    ↘
                  </span>

                  <div>
                    <span>Consumo</span>

                    <strong>
                      {formatNumber(
                        telemetry.consumo,
                        '%',
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="device-widget-loading">
              Este dispositivo todavía no tiene
              telemetría registrada.
            </div>
          )}

          <div className="device-card-actions">
            <button
              type="button"
              onClick={() =>
                loadLatestTelemetry(
                  device.id,
                )
              }
            >
              Telemetría
            </button>

            {canManageDevices && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openEditForm(device)
                  }
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDelete(device)
                  }
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        </article>
      )
    }

    return (
      <article
        key={device.id}
        className="device-card"
      >
        <div className="device-card-header">
          <div>
            <div className="device-type-label">
              {device.model?.type ??
                'DISPOSITIVO'}
            </div>

            <h2>
              {getDeviceTitle(device)}
            </h2>

            <p>
              {device.deviceCode ??
                'Sin código'}
            </p>
          </div>

          <span
            className={
              device.online
                ? 'device-online-badge device-online'
                : 'device-online-badge device-offline'
            }
          >
            <span />
            {device.online
              ? 'Online'
              : 'Offline'}
          </span>
        </div>

        <div className="device-location">
          <span>
            {device.site?.name ?? 'Sin sitio'}
          </span>

          <strong>·</strong>

          <span>
            {device.area?.name ?? 'Sin área'}
          </span>
        </div>

        <div className="device-inventory">
          <div>
            <span>Modelo</span>

            <strong>
              {getDeviceModel(device)}
            </strong>
          </div>

          <div>
            <span>IP</span>

            <strong>
              {device.ip ?? '—'}
            </strong>
          </div>

          <div>
            <span>Hostname</span>

            <strong>
              {device.hostname ?? '—'}
            </strong>
          </div>

          <div>
            <span>Última conexión</span>

            <strong>
              {formatDate(
                device.lastSeenAt,
              )}
            </strong>
          </div>
        </div>

        <div className="device-card-actions">
          {canManageDevices && (
            <>
              <button
                type="button"
                onClick={() =>
                  openEditForm(device)
                }
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDelete(device)
                }
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </article>
    )
  })}
</div>
)}
    </div>
  )
}

export default DevicesPage