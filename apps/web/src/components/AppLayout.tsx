import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface AppLayoutProps {
  children: ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const isSuperAdmin =
    user?.role === 'SUPER_ADMIN'

  const isOrgAdmin =
    user?.role === 'ORG_ADMIN'

  const isOperations =
    user?.role === 'OPERATIONS'

  const isTechnician =
    user?.role === 'TECHNICIAN'

  const canManageUsers =
    isSuperAdmin ||
    isOrgAdmin

  const canAccessOrganizations =
    isSuperAdmin ||
    isOrgAdmin

  const canAccessDiagnostics =
    isSuperAdmin ||
    isOrgAdmin ||
    isOperations ||
    isTechnician

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">

        <div className="sidebar-brand">
          <strong>TECNOCOM180</strong>
          <span>PLATFORM</span>
        </div>

        <nav className="sidebar-nav">

          {/* =====================================================
              DASHBOARD
          ===================================================== */}

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Dashboard
          </NavLink>

          {/* =====================================================
              ORGANIZACIÓN
              SUPER_ADMIN / ORG_ADMIN
          ===================================================== */}

          {canAccessOrganizations && (
            <NavLink
              to="/organizations"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              {isSuperAdmin
                ? 'Organizaciones'
                : 'Mi organización'}
            </NavLink>
          )}

          {/* =====================================================
              USUARIOS
              SUPER_ADMIN / ORG_ADMIN
          ===================================================== */}

          {canManageUsers && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              Usuarios
            </NavLink>
          )}

          {/* =====================================================
              SITIOS
              OPERACIÓN
          ===================================================== */}

          <NavLink
            to="/sites"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Sitios
          </NavLink>

          {/* =====================================================
              ÁREAS
              OPERACIÓN
          ===================================================== */}

          <NavLink
            to="/areas"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Áreas
          </NavLink>

          {/* =====================================================
              HABITACIONES
              OPERACIÓN
          ===================================================== */}

          <NavLink
            to="/rooms"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Habitaciones
          </NavLink>
          {/* =====================================================
              HUÉSPEDES
              SUPER_ADMIN
              ORG_ADMIN
              OPERATIONS
              RECEPTION
          ===================================================== */}

          {(isSuperAdmin ||
            isOrgAdmin ||
            isOperations ||
            user?.role === 'RECEPTION') && (
            <NavLink
              to="/guests"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              Huéspedes
            </NavLink>
          )}

          {/* =====================================================
              DISPOSITIVOS
              OPERACIÓN TÉCNICA
          ===================================================== */}

          <NavLink
            to="/devices"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Dispositivos
          </NavLink>

          {/* =====================================================
              TICKETS
          ===================================================== */}

          <NavLink
            to="/tickets"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Tickets
          </NavLink>

          {/* =====================================================
              DIAGNÓSTICOS
              SUPER_ADMIN
              ORG_ADMIN
              OPERATIONS
              TECHNICIAN

              RECEPTION NO TIENE ACCESO
          ===================================================== */}

          {canAccessDiagnostics && (
            <NavLink
              to="/diagnostics"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              Diagnósticos
            </NavLink>
          )}

        </nav>

        <div className="sidebar-footer">

          <div className="user-info">
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>

        </div>

      </aside>

      <div className="app-main">

        <header className="topbar">
          <span>
            Plataforma de gestión tecnológica
          </span>
        </header>

        <main className="app-content">
          {children}
        </main>

      </div>
    </div>
  )
}

export default AppLayout