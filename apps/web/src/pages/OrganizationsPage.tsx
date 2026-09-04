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
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingOrganization, setEditingOrganization] =
    useState<Organization | null>(null)

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
        const organization = await getOrganization(
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
  }, [isSuperAdmin, isOrgAdmin, user?.organizationId])

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
        slug: form.slug.trim().toLowerCase(),
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
    [...current, created].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  )
}

/*
 * Sincronizar el contexto global.
 *
 * Esto actualiza nombres, organizaciones
 * disponibles y sitios en el resto
 * de la aplicación.
 */
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
            active: !organization.active,
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
      <main className="page">
        <section className="card">
          <h2>Acceso no permitido</h2>
          <p>
            No tienes permisos para administrar
            organizaciones.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            TECNOCOM180 PLATFORM
          </p>

          <h1>Organizaciones</h1>

          <p className="subtitle">
            {isSuperAdmin
              ? 'Administración de organizaciones y clientes.'
              : 'Información de tu organización.'}
          </p>
        </div>

        <div className="site-count">
          {organizations.length}{' '}
          {organizations.length === 1
            ? 'organización'
            : 'organizaciones'}
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isSuperAdmin && (
        <section
          className="card"
          style={{
            marginBottom: '24px',
          }}
        >
          <button
            type="button"
            onClick={openCreateForm}
          >
            + Nueva organización
          </button>
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
            {editingOrganization
              ? 'EDITAR ORGANIZACIÓN'
              : 'NUEVA ORGANIZACIÓN'}
          </p>

          <h2>
            {editingOrganization
              ? editingOrganization.name
              : 'Registrar organización'}
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
                  placeholder="Hotel Ejemplo"
                />
              </label>

              <label>
                Slug

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
                />
              </label>

              <label>
                Teléfono

                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) =>
                    handleChange(
                      'phone',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Email

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    handleChange(
                      'email',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Zona horaria

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
                  : editingOrganization
                    ? 'Guardar cambios'
                    : 'Crear organización'}
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
        <p>Cargando organizaciones...</p>
      ) : organizations.length === 0 ? (
        <section className="card">
          <h2>No hay organizaciones</h2>

          <p>
            {isSuperAdmin
              ? 'Todavía no existen organizaciones registradas.'
              : 'No se encontró tu organización.'}
          </p>
        </section>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Organización</th>
                <th>Slug</th>
                <th>Contacto</th>
                <th>Sitios</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {organizations.map(
                (organization) => (
                  <tr key={organization.id}>
                    <td>
                      <strong>
                        {organization.name}
                      </strong>
                    </td>

                    <td>
                      {organization.slug}
                    </td>

                    <td>
                      <div>
                        {organization.email ??
                          '—'}
                      </div>

                      <div>
                        {organization.phone ??
                          '—'}
                      </div>
                    </td>

                    <td>
                      {organization.sites
                        ?.length ?? 0}
                    </td>

                    <td>
                      {organization.active
                        ? 'Activa'
                        : 'Inactiva'}
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
                            openEditForm(
                              organization,
                            )
                          }
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleActive(
                              organization,
                            )
                          }
                        >
                          {organization.active
                            ? 'Desactivar'
                            : 'Activar'}
                        </button>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                organization,
                              )
                            }
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default OrganizationsPage
