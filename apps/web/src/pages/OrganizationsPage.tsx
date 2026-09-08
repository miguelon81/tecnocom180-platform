import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../auth/AuthContext'
import { useSites } from '../sites/SiteContext'

import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizations,
  updateOrganization,
} from '../api/organizations'

import type { Organization } from '../api/organizations'

type OrganizationForm = {
  name: string
  slug: string
  phone: string
  email: string
  timezone: string
}

const emptyForm: OrganizationForm = {
  name: '',
  slug: '',
  phone: '',
  email: '',
  timezone: 'America/Mexico_City',
}

function OrganizationsPage() {
  const { user } = useAuth()
  const { refreshSites } = useSites()

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isOrgAdmin = user?.role === 'ORG_ADMIN'

  const [organizations, setOrganizations] = useState<
    Organization[]
  >([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] =
    useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)

  const [
    editingOrganization,
    setEditingOrganization,
  ] = useState<Organization | null>(null)

  const [form, setForm] =
    useState<OrganizationForm>(emptyForm)

  async function loadOrganizations() {
    try {
      setLoading(true)
      setError(null)

      if (isSuperAdmin) {
        const data = await getOrganizations()
        setOrganizations(data)
        return
      }

      if (isOrgAdmin && user?.organizationId) {
        const organization =
          await getOrganization(
            user.organizationId,
          )

        setOrganizations([organization])
        return
      }

      setOrganizations([])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las organizaciones',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrganizations()
  }, [
    isSuperAdmin,
    isOrgAdmin,
    user?.organizationId,
  ])

  function openCreateForm() {
    setEditingOrganization(null)
    setForm(emptyForm)
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(
    organization: Organization,
  ) {
    setEditingOrganization(organization)

    setForm({
      name: organization.name,
      slug: organization.slug,
      phone: organization.phone ?? '',
      email: organization.email ?? '',
      timezone:
        organization.timezone ??
        'America/Mexico_City',
    })

    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingOrganization(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function handleChange(
    field: keyof OrganizationForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.name.trim()) {
      setFormError(
        'El nombre de la organización es obligatorio',
      )
      return
    }

    if (!form.slug.trim()) {
      setFormError(
        'El slug de la organización es obligatorio',
      )
      return
    }

    try {
      setSaving(true)
      setFormError(null)

      const data = {
        name: form.name.trim(),
        slug: form.slug
          .trim()
          .toLowerCase(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        timezone:
          form.timezone.trim() ||
          'America/Mexico_City',
      }

      if (editingOrganization) {
        const updated =
          await updateOrganization(
            editingOrganization.id,
            data,
          )

        setOrganizations((current) =>
          current.map((organization) =>
            organization.id === updated.id
              ? updated
              : organization,
          ),
        )
      } else {
        const created =
          await createOrganization(data)

        setOrganizations((current) =>
          [...current, created].sort(
            (a, b) =>
              a.name.localeCompare(b.name),
          ),
        )
      }

      await refreshSites()
      closeForm()
    } catch (err) {
      console.error(err)

      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar la organización',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(
    organization: Organization,
  ) {
    try {
      setError(null)

      const updated =
        await updateOrganization(
          organization.id,
          {
            active:
              !organization.active,
          },
        )

      setOrganizations((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item,
        ),
      )

      await refreshSites()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado',
      )
    }
  }

  async function handleDelete(
    organization: Organization,
  ) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la organización "${organization.name}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      await deleteOrganization(
        organization.id,
      )

      setOrganizations((current) =>
        current.filter(
          (item) =>
            item.id !== organization.id,
        ),
      )

      await refreshSites()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar la organización',
      )
    }
  }

  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <main className="organizations-page">
        <section className="organizations-empty">
          <strong>
            Acceso no permitido
          </strong>

          <span>
            No tienes permisos para administrar
            organizaciones.
          </span>
        </section>
      </main>
    )
  }

  return (
    <main className="organizations-page">
      <section className="organizations-header">
        <div>
          <div className="organizations-eyebrow">
            Administración
          </div>

          <h1>Organizaciones</h1>

          <p>
            {isSuperAdmin
              ? 'Administra clientes, organizaciones y sus ubicaciones.'
              : 'Consulta y administra la información de tu organización.'}
          </p>
        </div>

        <div className="organizations-header-actions">
          <span className="organization-count">
            {organizations.length}{' '}
            {organizations.length === 1
              ? 'organización'
              : 'organizaciones'}
          </span>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={openCreateForm}
              className="organizations-primary-button"
            >
              + Nueva organización
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="organizations-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="organization-form-panel">
          <div className="organization-form-header">
            <div>
              <div className="organizations-eyebrow">
                {editingOrganization
                  ? 'Configuración'
                  : 'Nuevo cliente'}
              </div>

              <h2>
                {editingOrganization
                  ? `Editar ${editingOrganization.name}`
                  : 'Registrar organización'}
              </h2>

              <p>
                {editingOrganization
                  ? 'Actualiza los datos generales de la organización.'
                  : 'Registra una nueva organización dentro de TECNOCOM180.'}
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="organization-form-close"
            >
              Cerrar
            </button>
          </div>

          {formError && (
            <div className="organizations-error">
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="organization-form-grid"
          >
            <label className="organization-form-field">
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
                placeholder="Hotel Ejemplo"
                required
              />
            </label>

            <label className="organization-form-field">
              <span>Slug</span>

              <input
                type="text"
                value={form.slug}
                onChange={(event) =>
                  handleChange(
                    'slug',
                    event.target.value,
                  )
                }
                placeholder="hotel-ejemplo"
                required
              />
            </label>

            <label className="organization-form-field">
              <span>Teléfono</span>

              <input
                type="text"
                value={form.phone}
                onChange={(event) =>
                  handleChange(
                    'phone',
                    event.target.value,
                  )
                }
                placeholder="222 000 0000"
              />
            </label>

            <label className="organization-form-field">
              <span>Email</span>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  handleChange(
                    'email',
                    event.target.value,
                  )
                }
                placeholder="contacto@hotel.com"
              />
            </label>

            <label className="organization-form-field organization-form-full">
              <span>Zona horaria</span>

              <input
                type="text"
                value={form.timezone}
                onChange={(event) =>
                  handleChange(
                    'timezone',
                    event.target.value,
                  )
                }
                placeholder="America/Mexico_City"
              />
            </label>

            <div className="organization-form-actions organization-form-full">
              <button
                type="submit"
                disabled={saving}
                className="organizations-primary-button"
              >
                {saving
                  ? 'Guardando...'
                  : editingOrganization
                    ? 'Guardar cambios'
                    : 'Crear organización'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="organization-secondary-button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <section className="organizations-empty">
          <strong>
            Cargando organizaciones...
          </strong>

          <span>
            Obteniendo información de la plataforma.
          </span>
        </section>
      ) : organizations.length === 0 ? (
        <section className="organizations-empty">
          <strong>
            No hay organizaciones
          </strong>

          <span>
            {isSuperAdmin
              ? 'Todavía no existen organizaciones registradas.'
              : 'No se encontró tu organización.'}
          </span>
        </section>
      ) : (
        <div className="organizations-grid">
          {organizations.map(
            (organization) => {
              const siteCount =
                organization.sites?.length ??
                0

              return (
                <article
                  key={organization.id}
                  className={`organization-card ${
                    organization.active
                      ? ''
                      : 'organization-card-inactive'
                  }`}
                >
                  <div className="organization-card-header">
                    <div>
                      <div className="organization-slug">
                        {organization.slug}
                      </div>

                      <h2>
                        {organization.name}
                      </h2>
                    </div>

                    <span
                      className={`organization-status ${
                        organization.active
                          ? 'organization-status-active'
                          : 'organization-status-inactive'
                      }`}
                    >
                      <span className="organization-status-dot" />

                      {organization.active
                        ? 'Activa'
                        : 'Inactiva'}
                    </span>
                  </div>

                  <div className="organization-contact">
                    <div>
                      <span>Email</span>
                      <strong>
                        {organization.email ??
                          'No registrado'}
                      </strong>
                    </div>

                    <div>
                      <span>Teléfono</span>
                      <strong>
                        {organization.phone ??
                          'No registrado'}
                      </strong>
                    </div>
                  </div>

                  <div className="organization-summary">
                    <div>
                      <strong>
                        {siteCount}
                      </strong>

                      <span>
                        {siteCount === 1
                          ? 'Sitio'
                          : 'Sitios'}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {organization.timezone ??
                          'America/Mexico_City'}
                      </strong>

                      <span>
                        Zona horaria
                      </span>
                    </div>
                  </div>

                  <div className="organization-actions">
                    <button
                      type="button"
                      onClick={() =>
                        openEditForm(
                          organization,
                        )
                      }
                      className="organization-action-button"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleActive(
                          organization,
                        )
                      }
                      className="organization-action-button"
                    >
                      {organization.active
                        ? 'Desactivar'
                        : 'Activar'}
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleDelete(
                            organization,
                          )
                        }
                        className="organization-action-button organization-action-danger"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}
    </main>
  )
}

export default OrganizationsPage