import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createSite,
  deleteSite,
  getSites,
  updateSite,
} from '../api/sites'
import type { CreateSiteInput, UpdateSiteInput } from '../api/sites'
import type { Site } from '../types/site'

type SiteForm = {
  organizationId: string
  name: string
  code: string
  address: string
  city: string
  state: string
  country: string
  active: boolean
}

const emptyForm: SiteForm = {
  organizationId: '',
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  country: 'México',
  active: true,
}

function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [form, setForm] = useState<SiteForm>(emptyForm)

  async function loadSites() {
    try {
      setLoading(true)
      setError(null)

      const data = await getSites()
      setSites(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar los sitios',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [])

  function openCreateForm() {
    setEditingSite(null)
    setForm(emptyForm)
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(site: Site) {
    setEditingSite(site)
    setForm({
      organizationId: site.organizationId,
      name: site.name,
      code: site.code,
      address: site.address ?? '',
      city: site.city ?? '',
      state: site.state ?? '',
      country: site.country ?? 'México',
      active: site.active,
    })
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingSite(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function handleChange(
    field: keyof SiteForm,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.organizationId.trim()) {
      setFormError('La organización es obligatoria')
      return
    }

    if (!form.name.trim()) {
      setFormError('El nombre del sitio es obligatorio')
      return
    }

    if (!form.code.trim()) {
      setFormError('El código del sitio es obligatorio')
      return
    }

    try {
      setSaving(true)
      setFormError(null)

      if (editingSite) {
        const data: UpdateSiteInput = {
          name: form.name.trim(),
          code: form.code.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          active: form.active,
        }

        const updatedSite = await updateSite(
          editingSite.id,
          data,
        )

        setSites((current) =>
          current.map((site) =>
            site.id === updatedSite.id
              ? updatedSite
              : site,
          ),
        )
      } else {
        const data: CreateSiteInput = {
          organizationId: form.organizationId.trim(),
          name: form.name.trim(),
          code: form.code.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          active: form.active,
        }

        const createdSite = await createSite(data)

        setSites((current) =>
          [...current, createdSite].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        )
      }

      closeForm()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el sitio',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(site: Site) {
    try {
      setError(null)

      const updatedSite = await updateSite(site.id, {
        active: !site.active,
      })

      setSites((current) =>
        current.map((item) =>
          item.id === updatedSite.id
            ? updatedSite
            : item,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cambiar el estado del sitio',
      )
    }
  }

  async function handleDelete(site: Site) {
    const hasRelatedData =
      site.rooms.length > 0 ||
      site.areas.length > 0 ||
      site.devices.length > 0

    if (hasRelatedData) {
      setError(
        'No se puede eliminar este sitio porque tiene habitaciones, áreas o dispositivos relacionados.',
      )
      return
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el sitio "${site.name}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await deleteSite(site.id)

      setSites((current) =>
        current.filter((item) => item.id !== site.id),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al eliminar el sitio',
      )
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p>Cargando sitios...</p>
      </main>
    )
console.log(
  'SITES STATE ANTES DEL RENDER:',
  sites.map((site) => ({
    id: site.id,
    name: site.name,
    hasDevices: Object.prototype.hasOwnProperty.call(
      site,
      'devices',
    ),
    devices: site.devices,
  })),
)
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">TECNOCOM180 PLATFORM</p>

          <h1>Sitios</h1>

          <p className="subtitle">
            Gestión y supervisión de infraestructura
            tecnológica.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div className="site-count">
            {sites.length}{' '}
            {sites.length === 1 ? 'sitio' : 'sitios'}
          </div>

          <button
            type="button"
            onClick={openCreateForm}
          >
            + Nuevo sitio
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #dc2626',
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <section
          style={{
            marginBottom: '24px',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #d1d5db',
          }}
        >
          <div className="page-header">
            <div>
              <p className="eyebrow">
                {editingSite
                  ? 'EDITAR SITIO'
                  : 'NUEVO SITIO'}
              </p>

              <h2>
                {editingSite
                  ? editingSite.name
                  : 'Registrar sitio'}
              </h2>
            </div>
          </div>

          {formError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #dc2626',
              }}
            >
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
              {!editingSite && (
                <label>
                  Organización
                  <input
                    type="text"
                    value={form.organizationId}
                    onChange={(event) =>
                      handleChange(
                        'organizationId',
                        event.target.value,
                      )
                    }
                    placeholder="ID de organización"
                  />
                </label>
              )}

              <label>
                Nombre
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    handleChange(
                      'name',
                      event.target.value,
                    )
                  }
                  placeholder="Hotel Demo"
                />
              </label>

              <label>
                Código
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) =>
                    handleChange(
                      'code',
                      event.target.value.toUpperCase(),
                    )
                  }
                  placeholder="HOTEL-001"
                />
              </label>

              <label>
                Dirección
                <input
                  type="text"
                  value={form.address}
                  onChange={(event) =>
                    handleChange(
                      'address',
                      event.target.value,
                    )
                  }
                  placeholder="Dirección"
                />
              </label>

              <label>
                Ciudad
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) =>
                    handleChange(
                      'city',
                      event.target.value,
                    )
                  }
                  placeholder="Puebla"
                />
              </label>

              <label>
                Estado
                <input
                  type="text"
                  value={form.state}
                  onChange={(event) =>
                    handleChange(
                      'state',
                      event.target.value,
                    )
                  }
                  placeholder="Puebla"
                />
              </label>

              <label>
                País
                <input
                  type="text"
                  value={form.country}
                  onChange={(event) =>
                    handleChange(
                      'country',
                      event.target.value,
                    )
                  }
                  placeholder="México"
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
                  checked={form.active}
                  onChange={(event) =>
                    handleChange(
                      'active',
                      event.target.checked,
                    )
                  }
                />

                Sitio activo
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
                  : editingSite
                    ? 'Guardar cambios'
                    : 'Crear sitio'}
              </button>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="sites-grid">
        {sites.map((site) => {
        console.log(
  'RENDER SITE:',
  site.id,
  site.name,
  'devices:',
  site.devices,
)

const onlineDevices =
  site.devices.filter(
    (device) => device.online,
  ).length

          const offlineDevices =
            site.devices.length - onlineDevices

          return (
            <article
              className="site-card"
              key={site.id}
            >
              <div className="site-card-header">
                <div>
                  <p className="site-code">
                    {site.code}
                  </p>

                  <h2>{site.name}</h2>
                </div>

                <span
                  className={`status ${
                    site.active
                      ? 'status-active'
                      : 'status-inactive'
                  }`}
                >
                  {site.active
                    ? 'Activo'
                    : 'Inactivo'}
                </span>
              </div>

              <p className="site-location">
                {site.city ?? '-'}
                {site.state
                  ? `, ${site.state}`
                  : ''}
                {site.country
                  ? `, ${site.country}`
                  : ''}
              </p>

              <div className="site-stats">
                <div>
                  <strong>
                    {site.rooms.length}
                  </strong>
                  <span>Habitaciones</span>
                </div>

                <div>
                  <strong>
                    {site.areas.length}
                  </strong>
                  <span>Áreas</span>
                </div>

                <div>
                  <strong>
                    {site.devices.length}
                  </strong>
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

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '18px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    openEditForm(site)
                  }
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleActive(site)
                  }
                >
                  {site.active
                    ? 'Desactivar'
                    : 'Activar'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDelete(site)
                  }
                >
                  Eliminar
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {sites.length === 0 && (
        <section>
          <p>
            No hay sitios registrados.
          </p>

          {!showForm && (
            <button
              type="button"
              onClick={openCreateForm}
            >
              Crear primer sitio
            </button>
          )}
        </section>
      )}
    </main>
  )
}

export default SitesPage