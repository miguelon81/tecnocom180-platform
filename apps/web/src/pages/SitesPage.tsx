import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createSite,
  deleteSite,
  getSites,
  updateSite,
} from '../api/sites'

import type {
  CreateSiteInput,
  UpdateSiteInput,
} from '../api/sites'

import { getOrganizations } from '../api/organizations'

import type { Organization, Site } from '../types/site'

import { useAuth } from '../auth/AuthContext'
import { useSites } from '../sites/SiteContext'

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

const EMPTY_FORM: SiteForm = {
  organizationId: '',
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  country: 'México',
  active: true,
}

export default function SitesPage() {
  const { user: currentUser } = useAuth()
  const { refreshSites } = useSites()

  const [sites, setSites] = useState<Site[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)

  const [form, setForm] = useState<SiteForm>(EMPTY_FORM)

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN'

  const canManageSites = isSuperAdmin || isOrgAdmin

  /*
   * Carga de sitios.
   *
   * El backend ya aplica el aislamiento por organización.
   * No enviamos organizationId manualmente porque el JWT
   * es la fuente de verdad para ORG_ADMIN/RECEPTION/TECHNICIAN.
   */
  async function loadSites() {
    try {
      setError(null)

      const data = await getSites()

      setSites(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los sitios',
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * Las organizaciones solamente son necesarias para SUPER_ADMIN,
   * porque es el único rol que puede administrar múltiples
   * organizaciones.
   */
  async function loadOrganizations() {
    if (!isSuperAdmin) {
      return
    }

    try {
      setLoadingOrganizations(true)

      const data = await getOrganizations()

      setOrganizations(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las organizaciones',
      )
    } finally {
      setLoadingOrganizations(false)
    }
  }

  useEffect(() => {
    void loadSites()
  }, [])

  useEffect(() => {
    void loadOrganizations()
  }, [isSuperAdmin])

  /*
   * En teoría el backend ya devuelve los sitios correctos.
   *
   * Este filtro adicional evita mostrar accidentalmente un sitio
   * de otra organización si en el futuro cambia el comportamiento
   * de la API.
   */
  const visibleSites = useMemo(() => {
    if (!currentUser) {
      return []
    }

    if (isSuperAdmin) {
      return sites
    }

    return sites.filter(
      (site) => site.organizationId === currentUser.organizationId,
    )
  }, [sites, currentUser, isSuperAdmin])

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      organizationId: currentUser?.organizationId ?? '',
    })

    setEditingSite(null)
    setShowForm(false)
  }

  function openCreateForm() {
    if (!canManageSites) {
      return
    }

    setEditingSite(null)

    setForm({
      ...EMPTY_FORM,
      organizationId: currentUser?.organizationId ?? '',
    })

    setError(null)
    setShowForm(true)
  }

  function openEditForm(site: Site) {
    if (!canManageSites) {
      return
    }

    /*
     * Protección adicional en frontend.
     *
     * ORG_ADMIN no puede editar sitios de otra organización.
     */
    if (
      !isSuperAdmin &&
      site.organizationId !== currentUser?.organizationId
    ) {
      setError(
        'No puedes editar un sitio fuera de tu organización.',
      )

      return
    }

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

    setError(null)
    setShowForm(true)
  }

  function handleChange(
    field: keyof SiteForm,
    value: string | boolean,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentUser) {
      setError('No hay un usuario autenticado.')
      return
    }

    if (!form.name.trim()) {
      setError('El nombre del sitio es obligatorio.')
      return
    }

    if (!form.code.trim()) {
      setError('El código del sitio es obligatorio.')
      return
    }

    /*
     * Para ORG_ADMIN la organización siempre viene del usuario.
     *
     * Aunque alguien manipule el frontend, nunca permitimos
     * enviar otra organización.
     */
    const organizationId = isSuperAdmin
      ? form.organizationId
      : currentUser.organizationId

    if (!organizationId) {
      setError('Debes seleccionar una organización.')
      return
    }

    /*
     * Validación adicional para SUPER_ADMIN.
     */
    if (
      isSuperAdmin &&
      !organizations.some(
        (organization) => organization.id === organizationId,
      )
    ) {
      setError('La organización seleccionada no es válida.')
      return
    }

    /*
     * ORG_ADMIN solamente puede trabajar dentro de su organización.
     */
    if (
      !isSuperAdmin &&
      organizationId !== currentUser.organizationId
    ) {
      setError(
        'No puedes crear o modificar un sitio fuera de tu organización.',
      )

      return
    }

    try {
      setError(null)

      if (editingSite) {
        const data: UpdateSiteInput = {
          name: form.name.trim(),
          code: form.code.trim(),
          address: form.address.trim() || undefined,
city: form.city.trim() || undefined,
state: form.state.trim() || undefined,
country: form.country.trim() || undefined,
          active: form.active,
        }

        await updateSite(editingSite.id, data)
      } else {
        const data: CreateSiteInput = {
          organizationId,
          name: form.name.trim(),
          code: form.code.trim(),
         address: form.address.trim() || undefined,
city: form.city.trim() || undefined,
state: form.state.trim() || undefined,
country: form.country.trim() || undefined,
          active: form.active,
        }

        await createSite(data)
      }

      resetForm()
await refreshSites()

      await loadSites()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el sitio',
      )
    }
  }

  async function handleToggleActive(site: Site) {
    if (!canManageSites) {
      return
    }

    if (
      !isSuperAdmin &&
      site.organizationId !== currentUser?.organizationId
    ) {
      setError(
        'No puedes modificar un sitio fuera de tu organización.',
      )

      return
    }

    try {
      setError(null)

      await updateSite(site.id, {
        active: !site.active,
      })

      await loadSites()
await refreshSites()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el sitio',
      )
    }
  }

  async function handleDelete(site: Site) {
    if (!canManageSites) {
      return
    }

    if (
      !isSuperAdmin &&
      site.organizationId !== currentUser?.organizationId
    ) {
      setError(
        'No puedes eliminar un sitio fuera de tu organización.',
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

      await loadSites()
await refreshSites()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el sitio',
      )
    }
  }

  function getOrganizationName(site: Site) {
    if (site.organization?.name) {
      return site.organization.name
    }

    const organization = organizations.find(
      (item) => item.id === site.organizationId,
    )

    return organization?.name ?? site.organizationId
  }

   if (loading) {
    return (
      <main className="sites-page">
        <section className="sites-loading">
          <div className="sites-page-eyebrow">
            Infraestructura
          </div>

          <h1>Sitios</h1>

          <p>Cargando sitios...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="sites-page">
      <section className="sites-page-header">
        <div>
          <div className="sites-page-eyebrow">
            Infraestructura
          </div>

          <h1>Sitios</h1>

          <p>
            {isSuperAdmin
              ? 'Administra ubicaciones de todas las organizaciones.'
              : 'Administra las ubicaciones disponibles dentro de tu organización.'}
          </p>
        </div>

        <div className="sites-page-header-actions">
          <span className="site-count">
            {visibleSites.length}{' '}
            {visibleSites.length === 1
              ? 'sitio'
              : 'sitios'}
          </span>

          {canManageSites && (
            <button
              type="button"
              onClick={openCreateForm}
              className="sites-primary-button"
            >
              + Nuevo sitio
            </button>
          )}
        </div>
      </section>


    {error && (
      <div className="sites-error">
        {error}
      </div>
    )}

    {showForm && canManageSites && (
      <section className="site-form-panel">
        <div className="site-form-header">
          <div>
            <div className="site-form-eyebrow">
              {editingSite
                ? 'Configuración'
                : 'Nuevo registro'}
            </div>

            <h2>
              {editingSite
                ? 'Editar sitio'
                : 'Crear sitio'}
            </h2>

            <p>
              {editingSite
                ? 'Actualiza la información operativa de esta ubicación.'
                : 'Registra una nueva ubicación para comenzar a administrar su infraestructura.'}
            </p>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="site-form-close"
          >
            Cerrar
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="site-form-grid"
        >
          {isSuperAdmin && !editingSite && (
            <label className="site-form-field site-form-field-full">
              <span>Organización</span>

              <select
                value={form.organizationId}
                onChange={(event) =>
                  handleChange(
                    'organizationId',
                    event.target.value,
                  )
                }
                disabled={loadingOrganizations}
                required
              >
                <option value="">
                  {loadingOrganizations
                    ? 'Cargando organizaciones...'
                    : 'Selecciona una organización'}
                </option>

                {organizations
                  .filter(
                    (organization) =>
                      organization.active,
                  )
                  .map((organization) => (
                    <option
                      key={organization.id}
                      value={organization.id}
                    >
                      {organization.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {!isSuperAdmin && (
            <div className="site-form-context site-form-field-full">
              <span>Organización</span>
              <strong>
                {currentUser?.organizationId}
              </strong>
            </div>
          )}

          {editingSite && (
            <div className="site-form-context site-form-field-full">
              <span>Organización</span>
              <strong>
                {getOrganizationName(
                  editingSite,
                )}
              </strong>
            </div>
          )}

          <label className="site-form-field">
            <span>Nombre</span>

            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                handleChange(
                  'name',
                  event.target.value,
                )
              }
              placeholder="Hotel TECNOCOM180"
              required
            />
          </label>

          <label className="site-form-field">
            <span>Código</span>

            <input
              type="text"
              value={form.code}
              onChange={(event) =>
                handleChange(
                  'code',
                  event.target.value,
                )
              }
              placeholder="HOTEL-001"
              required
            />
          </label>

          <label className="site-form-field site-form-field-full">
            <span>Dirección</span>

            <input
              type="text"
              value={form.address}
              onChange={(event) =>
                handleChange(
                  'address',
                  event.target.value,
                )
              }
              placeholder="Dirección del sitio"
            />
          </label>

          <label className="site-form-field">
            <span>Ciudad</span>

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

          <label className="site-form-field">
            <span>Estado</span>

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

          <label className="site-form-field">
            <span>País</span>

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

          <label className="site-form-toggle">
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

            <span>
              <strong>Sitio activo</strong>
              <small>
                Disponible para operación y asignación.
              </small>
            </span>
          </label>

          <div className="site-form-actions site-form-field-full">
            <button
              type="submit"
              className="sites-primary-button"
            >
              {editingSite
                ? 'Guardar cambios'
                : 'Crear sitio'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="site-form-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    )}
  
{visibleSites.length === 0 ? (
  <section className="sites-empty">
    <strong>No hay sitios disponibles</strong>
    <span>
      {canManageSites
        ? 'Crea un sitio para comenzar a administrar su infraestructura.'
        : 'No tienes sitios asignados actualmente.'}
    </span>
  </section>
) : (
  <div className="sites-grid">
    {visibleSites.map((site) => {
      const onlineDevices =
        site.devices.filter(
          (device) => device.online,
        ).length

      const offlineDevices =
        site.devices.length - onlineDevices

      const location = [
        site.city,
        site.state,
        site.country,
      ]
        .filter(Boolean)
        .join(' · ')

      return (
        <article
          key={site.id}
          className={`site-card ${
            site.active
              ? ''
              : 'site-card-inactive'
          }`}
        >
          <div className="site-card-header">
            <div className="site-card-identity">
              <div className="site-code">
                {site.code}
              </div>

              <h2>{site.name}</h2>

              {isSuperAdmin && (
                <div className="site-organization">
                  {getOrganizationName(site)}
                </div>
              )}
            </div>

            <span
              className={`site-status ${
                site.active
                  ? 'site-status-active'
                  : 'site-status-inactive'
              }`}
            >
              <span className="site-status-dot" />

              {site.active
                ? 'Activo'
                : 'Inactivo'}
            </span>
          </div>

          <div className="site-location">
            <span className="site-location-icon">
              ⌖
            </span>

            <div>
              {site.address && (
                <strong>
                  {site.address}
                </strong>
              )}

              <span>
                {location ||
                  'Ubicación no registrada'}
              </span>
            </div>
          </div>

          <div className="site-stats">
            <div>
              <strong>
                {site.areas.length}
              </strong>
              <span>Áreas</span>
            </div>

            <div>
              <strong>
                {site.rooms.length}
              </strong>
              <span>Habitaciones</span>
            </div>

            <div>
              <strong>
                {site.devices.length}
              </strong>
              <span>Dispositivos</span>
            </div>
          </div>

          <div className="site-device-health">
            <div>
              <span className="site-health-dot site-health-online" />
              <strong>{onlineDevices}</strong>
              <span>en línea</span>
            </div>

            <div>
              <span className="site-health-dot site-health-offline" />
              <strong>{offlineDevices}</strong>
              <span>fuera de línea</span>
            </div>
          </div>

          {canManageSites && (
            <div className="site-actions">
              <button
                type="button"
                onClick={() =>
                  openEditForm(site)
                }
                className="site-action-button"
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleToggleActive(site)
                }
                className="site-action-button"
              >
                {site.active
                  ? 'Desactivar'
                  : 'Activar'}
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleDelete(site)
                }
                className="site-action-button site-action-danger"
              >
                Eliminar
              </button>
            </div>
          )}
        </article>
      )
    })}
  </div>
)}
        
      
        </main>
   )
}
    