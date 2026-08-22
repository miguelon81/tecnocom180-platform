import { useEffect, useState } from 'react'
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

type UserForm = {
  name: string
  email: string
  passwordHash: string
  phone: string
  role: UserRole
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  passwordHash: '',
  phone: '',
  role: 'TECHNICIAN',
}

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Administrador',
  RECEPTION: 'Recepción',
  TECHNICIAN: 'Técnico',
}

function UsersPage() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [form, setForm] = useState<UserForm>(emptyForm)

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

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

  function openCreateForm() {
    setEditingUser(null)
    setForm(emptyForm)
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(user: User) {
    setEditingUser(user)

    setForm({
      name: user.name,
      email: user.email,
      passwordHash: '',
      phone: user.phone ?? '',
      role: user.role,
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
    setForm(emptyForm)
    setFormError(null)
  }

  function handleChange(
    field: keyof UserForm,
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
      setFormError('El nombre es obligatorio')
      return
    }

    if (!form.email.trim()) {
      setFormError('El correo electrónico es obligatorio')
      return
    }

    if (!editingUser && !form.passwordHash.trim()) {
      setFormError('La contraseña temporal es obligatoria')
      return
    }

    if (!isSuperAdmin && form.role === 'SUPER_ADMIN') {
      setFormError(
        'Un Administrador de organización no puede crear ni asignar Super Admin',
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
          phone: form.phone.trim() || null,
        }

        if (form.passwordHash.trim()) {
          data.passwordHash = form.passwordHash.trim()
        }

        if (isSuperAdmin) {
          data.role = form.role
        } else if (editingUser.role !== 'SUPER_ADMIN') {
          data.role = form.role
        }

        const updatedUser = await updateUser(
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
        const organizationId =
          currentUser?.organizationId

        if (!organizationId) {
          setFormError(
            'No se encontró la organización del usuario actual',
          )
          return
        }

        const data: CreateUserInput = {
          organizationId,
          name: form.name.trim(),
          email: form.email.trim(),
          passwordHash: form.passwordHash.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
        }

        const createdUser = await createUser(data)

        setUsers((current) =>
          [...current, createdUser].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        )
      }

      closeForm()
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

  async function handleToggleActive(user: User) {
    if (user.id === currentUser?.id) {
      setError('No puedes desactivar tu propio usuario')
      return
    }

    try {
      setError(null)

      if (user.active) {
        await deactivateUser(user.id)

        setUsers((current) =>
          current.map((item) =>
            item.id === user.id
              ? { ...item, active: false }
              : item,
          ),
        )
      } else {
        const updatedUser = await updateUser(
          user.id,
          { active: true },
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
            Administración de usuarios y permisos de la
            organización.
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
                    handleChange(
                      'role',
                      event.target.value,
                    )
                  }
                >
                  {isSuperAdmin && (
                    <option value="SUPER_ADMIN">
                      Super Admin
                    </option>
                  )}

                  <option value="ORG_ADMIN">
                    Administrador
                  </option>

                  <option value="RECEPTION">
                    Recepción
                  </option>

                  <option value="TECHNICIAN">
                    Técnico
                  </option>
                </select>
              </label>

              <label>
                {editingUser
                  ? 'Nueva contraseña (opcional)'
                  : 'Contraseña temporal'}

                <input
                  type="password"
                  value={form.passwordHash}
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
              border: '1px solid #d1d5db',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '20px',
                alignItems: 'flex-start',
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

                <p style={{ margin: '6px 0' }}>
                  {item.email}
                </p>

                {item.phone && (
                  <p style={{ margin: '6px 0' }}>
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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '18px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
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
                    {item.organization.name}
                  </span>
                )}
              </div>

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
                    openEditForm(item)
                  }
                >
                  Editar
                </button>

                <button
                  type="button"
                  disabled={
                    item.id === currentUser?.id
                  }
                  onClick={() =>
                    handleToggleActive(item)
                  }
                >
                  {item.active
                    ? 'Desactivar'
                    : 'Activar'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {users.length === 0 && (
        <section>
          <p>No hay usuarios registrados.</p>

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
