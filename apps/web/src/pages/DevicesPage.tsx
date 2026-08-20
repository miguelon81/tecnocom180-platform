import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { apiFetch } from '../api/client'
import { getSites } from '../api/sites'
import { getAreas } from '../api/areas'
import { getBrands } from '../api/brands'
import { getModels } from '../api/models'

import type { Site, Area } from '../types/site'
import type { Brand } from '../api/brands'
import type { DeviceModel } from '../api/models'

type Device = {
  id: string
  siteId: string
  areaId?: string | null
  modelId: string
  hostname?: string | null
  serial?: string | null
  ip?: string | null
  mac?: string | null
  firmware?: string | null
  online: boolean
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
  hostname: string
  serial: string
  ip: string
  mac: string
  firmware: string
  online: boolean
}

const emptyForm: DeviceForm = {
  siteId: '',
  areaId: '',
  brandId: '',
  modelId: '',
  hostname: '',
  serial: '',
  ip: '',
  mac: '',
  firmware: '',
  online: false,
}

function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])

  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  const [form, setForm] = useState<DeviceForm>(emptyForm)

  async function loadDevices() {
    try {
      setLoading(true)
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

      const response = await apiFetch(`/devices${suffix}`)

      if (!response.ok) {
        throw new Error('No se pudieron cargar los dispositivos')
      }

      const data = await response.json()

      setDevices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los dispositivos',
      )
    } finally {
      setLoading(false)
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
        const firstSiteId = siteData[0].id

        setSelectedSiteId(firstSiteId)

        const areaData = await getAreas(firstSiteId)

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
        const data = await getAreas(selectedSiteId)

        setAreas(data)

        setSelectedAreaId((current) =>
          data.some((area) => area.id === current)
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
    if (sites.length === 0) {
      return
    }

    loadDevices()
  }, [selectedSiteId, selectedAreaId])

  function handleFormChange(
    field: keyof DeviceForm,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function openCreateForm() {
    setEditingDevice(null)

    setForm({
      ...emptyForm,
      siteId: selectedSiteId,
      areaId: '',
    })

    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(device: Device) {
    const brandId = device.model?.brand?.id ?? ''

    setEditingDevice(device)

    setForm({
      siteId: device.siteId,
      areaId: device.areaId ?? '',
      brandId,
      modelId: device.modelId,
      hostname: device.hostname ?? '',
      serial: device.serial ?? '',
      ip: device.ip ?? '',
      mac: device.mac ?? '',
      firmware: device.firmware ?? '',
      online: device.online,
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
    setFormError(null)
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.siteId) {
      setFormError('El sitio es obligatorio')
      return
    }

    if (!form.modelId) {
      setFormError('El modelo es obligatorio')
      return
    }

    try {
      setSaving(true)
      setFormError(null)

      const body = {
        siteId: form.siteId,
        areaId: form.areaId || null,
        modelId: form.modelId,
        hostname: form.hostname.trim() || null,
        serial: form.serial.trim() || null,
        ip: form.ip.trim() || null,
        mac: form.mac.trim() || null,
        firmware: form.firmware.trim() || null,
        online: form.online,
      }

      if (editingDevice) {
        const response = await apiFetch(
          `/devices/${editingDevice.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(body),
          },
        )

        if (!response.ok) {
          const data = await response.json().catch(() => null)

          throw new Error(
            data?.error ?? 'No se pudo actualizar el dispositivo',
          )
        }

        const updatedDevice = await response.json()

        setDevices((current) =>
          current.map((device) =>
            device.id === updatedDevice.id
              ? updatedDevice
              : device,
          ),
        )
      } else {
        const response = await apiFetch('/devices', {
          method: 'POST',
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)

          throw new Error(
            data?.error ?? 'No se pudo crear el dispositivo',
          )
        }

        const createdDevice = await response.json()

        setDevices((current) => [
          createdDevice,
          ...current,
        ])
      }

      closeForm()
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

  async function handleDelete(device: Device) {
    const name =
      device.hostname ??
      device.serial ??
      device.id

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el dispositivo "${name}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      const response = await apiFetch(
        `/devices/${device.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        throw new Error(
          data?.error ??
            'No se pudo eliminar el dispositivo',
        )
      }

      setDevices((current) =>
        current.filter(
          (item) => item.id !== device.id,
        ),
      )
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Error al eliminar el dispositivo',
      )
    }
  }

  const availableModels = form.brandId
    ? models.filter(
        (model) =>
          model.brandId === form.brandId,
      )
    : []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>Dispositivos</h1>

          <p>
            Inventario de infraestructura tecnológica
            de los sitios.
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
                value={selectedSiteId}
                onChange={(event) =>
                  setSelectedSiteId(
                    event.target.value,
                  )
                }
              >
                {sites.map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Área
              <select
                value={selectedAreaId}
                onChange={(event) =>
                  setSelectedAreaId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Todas las áreas
                </option>

                {areas.map((area) => (
                  <option
                    key={area.id}
                    value={area.id}
                  >
                    {area.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={openCreateForm}
            >
              + Nuevo dispositivo
            </button>
          </div>
        </section>
      )}

      {showForm && (
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
              ? editingDevice.hostname ??
                editingDevice.serial ??
                'Dispositivo'
              : 'Registrar dispositivo'}
          </h2>

          {formError && (
            <div className="error-message">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                  value={form.siteId}
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
                  disabled={!!editingDevice}
                >
                  <option value="">
                    Selecciona un sitio
                  </option>

                  {sites.map((site) => (
                    <option
                      key={site.id}
                      value={site.id}
                    >
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Área
                <select
                  value={form.areaId}
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

                  {areas
                    .filter(
                      (area) =>
                        area.siteId ===
                        form.siteId,
                    )
                    .map((area) => (
                      <option
                        key={area.id}
                        value={area.id}
                      >
                        {area.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Marca
                <select
                  value={form.brandId}
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

                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.id}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Modelo
                <select
                  value={form.modelId}
                  disabled={!form.brandId}
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
                Hostname
                <input
                  type="text"
                  value={form.hostname}
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
                  value={form.serial}
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
                  value={form.firmware}
                  onChange={(event) =>
                    handleFormChange(
                      'firmware',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.online}
                  onChange={(event) =>
                    handleFormChange(
                      'online',
                      event.target.checked,
                    )
                  }
                />
                Online
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
                onClick={closeForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <p>Cargando dispositivos...</p>
      ) : sites.length === 0 ? (
        <section className="card">
          <h2>No hay sitios registrados</h2>
          <p>
            Primero debes registrar un sitio para
            poder crear dispositivos.
          </p>
        </section>
      ) : devices.length === 0 ? (
        <section className="card">
          <h2>No hay dispositivos registrados</h2>
          <p>
            No existen dispositivos para el sitio y
            área seleccionados.
          </p>
        </section>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Modelo</th>
                <th>Tipo</th>
                <th>Sitio</th>
                <th>Área</th>
                <th>IP</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <strong>
                      {device.hostname ||
                        device.serial ||
                        device.id}
                    </strong>
                  </td>

                  <td>
                    {device.model
                      ? `${device.model.brand?.name ?? ''} ${device.model.name}`
                      : '—'}
                  </td>

                  <td>
                    {device.model?.type ?? '—'}
                  </td>

                  <td>
                    {device.site?.name ?? '—'}
                  </td>

                  <td>
                    {device.area?.name ?? 'Sin área'}
                  </td>

                  <td>
                    {device.ip ?? '—'}
                  </td>

                  <td>
                    {device.online
                      ? 'Online'
                      : 'Offline'}
                  </td>

                  <td>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
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
                    </div>
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

export default DevicesPage
