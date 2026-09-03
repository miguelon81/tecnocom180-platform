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
      <div className="p-6">
        <h1 className="text-2xl font-semibold">
          Sitios
        </h1>

        <p className="mt-4 text-gray-600">
          Cargando sitios...
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Sitios
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            {isSuperAdmin
              ? 'Administración de sitios de todas las organizaciones.'
              : 'Sitios disponibles dentro de tu organización.'}
          </p>
        </div>

        {canManageSites && (
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            + Nuevo sitio
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && canManageSites && (
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {editingSite
                ? 'Editar sitio'
                : 'Nuevo sitio'}
            </h2>

            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {isSuperAdmin && !editingSite && (
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm font-medium">
                  Organización
                </span>

                <select
                  value={form.organizationId}
                  onChange={(event) =>
                    handleChange(
                      'organizationId',
                      event.target.value,
                    )
                  }
                  disabled={loadingOrganizations}
                  className="rounded border px-3 py-2"
                  required
                >
                  <option value="">
                    {loadingOrganizations
                      ? 'Cargando organizaciones...'
                      : 'Selecciona una organización'}
                  </option>

                  {organizations
                    .filter((organization) => organization.active)
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
              <div className="rounded bg-gray-50 px-3 py-2 text-sm md:col-span-2">
                <span className="font-medium">
                  Organización:
                </span>{' '}
                {currentUser?.organizationId}
              </div>
            )}

            {editingSite && (
              <div className="rounded bg-gray-50 px-3 py-2 text-sm md:col-span-2">
                <span className="font-medium">
                  Organización:
                </span>{' '}
                {getOrganizationName(editingSite)}
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Nombre
              </span>

              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  handleChange('name', event.target.value)
                }
                className="rounded border px-3 py-2"
                placeholder="Hotel TECNOCOM180"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Código
              </span>

              <input
                type="text"
                value={form.code}
                onChange={(event) =>
                  handleChange('code', event.target.value)
                }
                className="rounded border px-3 py-2"
                placeholder="HOTEL-001"
                required
              />
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm font-medium">
                Dirección
              </span>

              <input
                type="text"
                value={form.address}
                onChange={(event) =>
                  handleChange(
                    'address',
                    event.target.value,
                  )
                }
                className="rounded border px-3 py-2"
                placeholder="Dirección del sitio"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Ciudad
              </span>

              <input
                type="text"
                value={form.city}
                onChange={(event) =>
                  handleChange('city', event.target.value)
                }
                className="rounded border px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Estado
              </span>

              <input
                type="text"
                value={form.state}
                onChange={(event) =>
                  handleChange('state', event.target.value)
                }
                className="rounded border px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                País
              </span>

              <input
                type="text"
                value={form.country}
                onChange={(event) =>
                  handleChange(
                    'country',
                    event.target.value,
                  )
                }
                className="rounded border px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2">
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

              <span className="text-sm font-medium">
                Sitio activo
              </span>
            </label>

            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
              >
                {editingSite
                  ? 'Guardar cambios'
                  : 'Crear sitio'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="rounded border px-5 py-2 font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {visibleSites.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          No hay sitios disponibles.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {visibleSites.map((site) => {
            const onlineDevices = site.devices.filter(
              (device) => device.online,
            ).length

            const offlineDevices =
              site.devices.length - onlineDevices

            return (
              <div
                key={site.id}
                className="rounded-lg border bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {site.name}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Código: {site.code}
                    </p>

                    {isSuperAdmin && (
                      <p className="mt-1 text-sm text-gray-500">
                        Organización:{' '}
                        {getOrganizationName(site)}
                      </p>
                    )}
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      site.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {site.active
                      ? 'Activo'
                      : 'Inactivo'}
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-sm text-gray-600">
                  {site.address && (
                    <p>{site.address}</p>
                  )}

                  {(site.city || site.state) && (
                    <p>
                      {[site.city, site.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}

                  {site.country && (
                    <p>{site.country}</p>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded bg-gray-50 p-3 text-center">
                    <div className="text-xl font-semibold">
                      {site.areas.length}
                    </div>

                    <div className="text-xs text-gray-500">
                      Áreas
                    </div>
                  </div>

                  <div className="rounded bg-gray-50 p-3 text-center">
                    <div className="text-xl font-semibold">
                      {site.rooms.length}
                    </div>

                    <div className="text-xs text-gray-500">
                      Habitaciones
                    </div>
                  </div>

                  <div className="rounded bg-gray-50 p-3 text-center">
                    <div className="text-xl font-semibold">
                      {site.devices.length}
                    </div>

                    <div className="text-xs text-gray-500">
                      Dispositivos
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-4 text-sm">
                  <span className="text-green-700">
                    {onlineDevices} en línea
                  </span>

                  <span className="text-gray-500">
                    {offlineDevices} fuera de línea
                  </span>
                </div>

                {canManageSites && (
                  <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => openEditForm(site)}
                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleActive(site)
                      }
                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {site.active
                        ? 'Desactivar'
                        : 'Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(site)}
                      className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}