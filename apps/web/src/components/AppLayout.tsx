import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface AppLayoutProps {
  children: ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

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
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
  to="/sites"
  className={({ isActive }) =>
    `nav-item ${isActive ? 'nav-item-active' : ''}`
  }
>
  Sitios
</NavLink>

<NavLink
  to="/areas"
  className={({ isActive }) =>
    `nav-item ${isActive ? 'nav-item-active' : ''}`
  }
>
  Áreas
</NavLink>

<NavLink
  to="/rooms"
  className={({ isActive }) =>
    `nav-item ${isActive ? 'nav-item-active' : ''}`
  }
>
  Habitaciones
</NavLink>
          <NavLink
            to="/devices"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Dispositivos
          </NavLink>

          <NavLink
            to="/tickets"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Tickets
          </NavLink>

          <NavLink
            to="/diagnostics"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            Diagnósticos
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>

          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <span>Plataforma de gestión tecnológica</span>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}

export default AppLayout