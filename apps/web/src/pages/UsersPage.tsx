import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createUser,
  deactivateUser,
  getUsers,
  updateUser,
} from '../api/users'

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserRole,
} from '../api/users'

import { useAuth } from '../auth/AuthContext'
import { useSites } from '../sites/SiteContext'

type UserForm = {
  organizationId: string
  name: string
  email: string
  passwordHash: string
  phone: string
  role: UserRole
  siteIds: string[]
}

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Administrador',
  OPERATIONS: 'Operaciones',
  RECEPTION: 'Recepción',
  TECHNICIAN: 'Técnico',
}

function isSiteScopedRole(role: UserRole) {
  return (
    role === 'RECEPTION' ||
    role === 'TECHNICIAN'
  )
}

function UsersPage() {
  const { user: currentUser } = useAuth()

  const {
    organizations,
    selectedOrganizationId,
    sites,
  } = useSites()

  const [users, setUsers] = useState<User[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [formError, setFormError] =
    useState<string | null>(null)

  const [showForm, setShowForm] =
    useState(false)

  const [editingUser, setEditingUser] =
    useState<User | null>(null)

  const isSuperAdmin =
    currentUser?.role === 'SUPER_ADMIN'

  const defaultOrganizationId =
    isSuperAdmin
      ? selectedOrganizationId ?? ''
      : currentUser?.organizationId ?? ''

  const [form, setForm] =
    useState<UserForm>({
      organizationId: '',
      name: '',
      email: '',
      passwordHash: '',
      phone: '',
      role: 'TECHNICIAN',
      siteIds: [],
    })

  const availableRoles =
    useMemo<UserRole[]>(() => {
      if (isSuperAdmin) {
        return [
          'SUPER_ADMIN',
          'OPERATIONS',
          'ORG_ADMIN',
          'RECEPTION',
          'TECHNICIAN',
        ]
      }

      return [
        'ORG_ADMIN',
        'RECEPTION',
        'TECHNICIAN',
      ]
    }, [isSuperAdmin])

  const availableSites = useMemo(
    () =>
      sites.filter(
        (site) =>
          site.organizationId ===
          form.organizationId,
      ),
    [sites, form.organizationId],
  )

  async function loadUsers() {
    try {
      setLoading(true)
      setError(null)

      const data = await getUsers()

      setUsers(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar los usuarios',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  function createEmptyForm(): UserForm {
    return {
      organizationId: defaultOrganizationId,
      name: '',
      email: '',
      passwordHash: '',
      phone: '',
      role: 'TECHNICIAN',
      siteIds: [],
    }
  }

  function openCreateForm() {
    setEditingUser(null)
    setForm(createEmptyForm())
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(user: User) {
    setEditingUser(user)

    setForm({
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      passwordHash: '',
      phone: user.phone ?? '',
      role: user.role,
      siteIds:
        user.sites?.map(
          (assignment) =>
            assignment.siteId,
        ) ?? [],
    })

    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    if (saving) {
      return
    }

    setShowForm(false)
    setEditingUser(null)
    setForm(createEmptyForm())
    setFormError(null)
  }

  function handleChange(
    field:
      | 'organizationId'
      | 'name'
      | 'email'
      | 'passwordHash'
      | 'phone',
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleOrganizationChange(
    organizationId: string,
  ) {
    setForm((current) => ({
      ...current,
      organizationId,
      siteIds: [],
    }))
  }

  function handleRoleChange(
    role: UserRole,
  ) {
    setForm((current) => ({
      ...current,
      role,
      siteIds: isSiteScopedRole(role)
        ? current.siteIds
        : [],
    }))
  }

  function handleSiteToggle(
    siteId: string,
  ) {
    setForm((current) => {
      const exists =
        current.siteIds.includes(siteId)

      return {
        ...current,
        siteIds: exists
          ? current.siteIds.filter(
              (id) => id !== siteId,
            )
          : [...current.siteIds, siteId],
      }
    })
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.name.trim()) {
      setFormError(
        'El nombre es obligatorio',
      )
      return
    }

    if (!form.email.trim()) {
      setFormError(
        'El correo electrónico es obligatorio',
      )
      return
    }

    if (
      !editingUser &&
      !form.passwordHash.trim()
    ) {
      setFormError(
        'La contraseña temporal es obligatoria',
      )
      return
    }

    if (!form.organizationId) {
      setFormError(
        'La organización es obligatoria',
      )
      return
    }

    if (
      isSiteScopedRole(form.role) &&
      form.siteIds.length === 0
    ) {
      setFormError(
        'Selecciona al menos un sitio para este usuario',
      )
      return
    }

    if (
      !isSuperAdmin &&
      (
        form.role === 'SUPER_ADMIN' ||
        form.role === 'OPERATIONS'
      )
    ) {
      setFormError(
        'No tienes permiso para asignar este rol',
      )
      return
    }

    try {
      setSaving(true)
      setFormError(null)

      if (editingUser) {
        const data: UpdateUserInput = {
          name: form.name.trim(),
          email: form.email.trim(),
          phone:
            form.phone.trim() || null,
          role: form.role,
          siteIds: isSiteScopedRole(
            form.role,
          )
            ? form.siteIds
            : [],
        }

        if (isSuperAdmin) {
          data.organizationId =
            form.organizationId
        }

        if (
          form.passwordHash.trim()
        ) {
          data.passwordHash =
            form.passwordHash.trim()
        }

        const updatedUser =
          await updateUser(
            editingUser.id,
            data,
          )

        setUsers((current) =>
          current.map((item) =>
            item.id === updatedUser.id
              ? updatedUser
              : item,
          ),
        )
      } else {
        const data: CreateUserInput = {
          name: form.name.trim(),
          email: form.email.trim(),
          passwordHash:
            form.passwordHash.trim(),
          phone:
            form.phone.trim() || null,
          role: form.role,
          siteIds: isSiteScopedRole(
            form.role,
          )
            ? form.siteIds
            : [],
        }

        if (isSuperAdmin) {
          data.organizationId =
            form.organizationId
        }

        const createdUser =
          await createUser(data)

        setUsers((current) =>
          [...current, createdUser].sort(
            (a, b) =>
              a.name.localeCompare(b.name),
          ),
        )
      }

      setShowForm(false)
      setEditingUser(null)
      setForm(createEmptyForm())
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el usuario',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(
    user: User,
  ) {
    if (user.id === currentUser?.id) {
      setError(
        'No puedes desactivar tu propio usuario',
      )
      return
    }

    try {
      setError(null)

      if (user.active) {
        const updatedUser =
          await deactivateUser(user.id)

        setUsers((current) =>
          current.map((item) =>
            item.id === updatedUser.id
              ? updatedUser
              : item,
          ),
        )
      } else {
        const updatedUser =
          await updateUser(
            user.id,
            {
              active: true,
            },
          )

        setUsers((current) =>
          current.map((item) =>
            item.id === updatedUser.id
              ? updatedUser
              : item,
          ),
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cambiar el estado del usuario',
      )
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p>Cargando usuarios...</p>
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

          <h1>Usuarios</h1>

          <p className="subtitle">
            Administración de usuarios,
            roles y alcance por sitio.
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
            {users.length}{' '}
            {users.length === 1
              ? 'usuario'
              : 'usuarios'}
          </div>

          <button
            type="button"
            onClick={openCreateForm}
          >
            + Nuevo usuario
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            border:
              '1px solid #dc2626',
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
            border:
              '1px solid #d1d5db',
          }}
        >
          <div className="page-header">
            <div>
              <p className="eyebrow">
                {editingUser
                  ? 'EDITAR USUARIO'
                  : 'NUEVO USUARIO'}
              </p>

              <h2>
                {editingUser
                  ? editingUser.name
                  : 'Registrar usuario'}
              </h2>
            </div>
          </div>

          {formError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                border:
                  '1px solid #dc2626',
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
              {isSuperAdmin && (
                <label>
                  Organización

                  <select
                    value={
                      form.organizationId
                    }
                    onChange={(event) =>
                      handleOrganizationChange(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Selecciona una organización
                    </option>

                    {organizations
                      .filter(
                        (organization) =>
                          organization.active,
                      )
                      .map(
                        (organization) => (
                          <option
                            key={
                              organization.id
                            }
                            value={
                              organization.id
                            }
                          >
                            {
                              organization.name
                            }
                          </option>
                        ),
                      )}
                  </select>
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
                  placeholder="Nombre completo"
                />
              </label>

              <label>
                Correo electrónico

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    handleChange(
                      'email',
                      event.target.value,
                    )
                  }
                  placeholder="usuario@empresa.com"
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
                  placeholder="2220000000"
                />
              </label>

              <label>
                Rol

                <select
                  value={form.role}
                  onChange={(event) =>
                    handleRoleChange(
                      event.target
                        .value as UserRole,
                    )
                  }
                >
                  {availableRoles.map(
                    (role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {roleLabels[role]}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                {editingUser
                  ? 'Nueva contraseña (opcional)'
                  : 'Contraseña temporal'}

                <input
                  type="password"
                  value={
                    form.passwordHash
                  }
                  onChange={(event) =>
                    handleChange(
                      'passwordHash',
                      event.target.value,
                    )
                  }
                  placeholder="Contraseña"
                />
              </label>
            </div>

            {isSiteScopedRole(
              form.role,
            ) && (
              <div
                style={{
                  marginTop: '20px',
                }}
              >
                <strong>
                  Sitios asignados
                </strong>

                <p
                  style={{
                    margin:
                      '6px 0 12px',
                    opacity: 0.7,
                  }}
                >
                  Selecciona los sitios a
                  los que tendrá acceso este
                  usuario.
                </p>

                {availableSites.length ===
                0 ? (
                  <p>
                    No hay sitios disponibles
                    para esta organización.
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gap: '10px',
                    }}
                  >
                    {availableSites.map(
                      (site) => (
                        <label
                          key={site.id}
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: '10px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={form.siteIds.includes(
                              site.id,
                            )}
                            onChange={() =>
                              handleSiteToggle(
                                site.id,
                              )
                            }
                          />

                          <span>
                            {site.name}{' '}
                            ({site.code})
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

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
                  : editingUser
                    ? 'Guardar cambios'
                    : 'Crear usuario'}
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

      <section
        style={{
          display: 'grid',
          gap: '12px',
        }}
      >
        {users.map((item) => (
          <article
            key={item.id}
            style={{
              padding: '20px',
              borderRadius: '12px',
              border:
                '1px solid #d1d5db',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                gap: '20px',
                alignItems:
                  'flex-start',
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: '18px',
                  }}
                >
                  {item.name}
                </p>

                <p
                  style={{
                    margin: '6px 0',
                  }}
                >
                  {item.email}
                </p>

                {item.phone && (
                  <p
                    style={{
                      margin: '6px 0',
                    }}
                  >
                    {item.phone}
                  </p>
                )}
              </div>

              <span
                className={`status ${
                  item.active
                    ? 'status-active'
                    : 'status-inactive'
                }`}
              >
                {item.active
                  ? 'Activo'
                  : 'Inactivo'}
              </span>
            </div>

            <div
              style={{
                marginTop: '14px',
              }}
            >
              <strong>
                {roleLabels[item.role]}
              </strong>

              {item.organization && (
                <span
                  style={{
                    marginLeft: '12px',
                    opacity: 0.7,
                  }}
                >
                  {
                    item.organization
                      .name
                  }
                </span>
              )}

              {item.sites?.length >
                0 && (
                <div
                  style={{
                    marginTop: '8px',
                    opacity: 0.8,
                  }}
                >
                  Sitios:{' '}
                  {item.sites
                    .map(
                      (assignment) =>
                        assignment.site
                          .name,
                    )
                    .join(', ')}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                alignItems: 'center',
                marginTop: '18px',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  openEditForm(item)
                }
              >
                Editar
              </button>

              <button
                type="button"
                disabled={
                  item.id ===
                  currentUser?.id
                }
                onClick={() =>
                  handleToggleActive(
                    item,
                  )
                }
              >
                {item.active
                  ? 'Desactivar'
                  : 'Activar'}
              </button>
            </div>
          </article>
        ))}
      </section>

      {users.length === 0 && (
        <section>
          <p>
            No hay usuarios registrados.
          </p>

          {!showForm && (
            <button
              type="button"
              onClick={openCreateForm}
            >
              Crear primer usuario
            </button>
          )}
        </section>
      )}
    </main>
  )
}

export default UsersPage