import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import AppLayout from './components/AppLayout'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SitesPage from './pages/SitesPage'
import RoomsPage from './pages/RoomsPage'
import DevicesPage from './pages/DevicesPage'
import TicketsPage from './pages/TicketsPage'
import DiagnosticsPage from './pages/DiagnosticsPage'
import AreasPage from './pages/AreasPage'
import OrganizationsPage from './pages/OrganizationsPage'
import UsersPage from './pages/UsersPage'


import './App.css'

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        {/* =====================================================
            LOGIN
        ===================================================== */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        {/* =====================================================
            DASHBOARD
        ===================================================== */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

$path = '.\apps\web\src\App.tsx'

$content = Get-Content $path -Raw

$marker = @'
        {/* =====================================================
            SITES
        ===================================================== */}
'@

$route = @'
        {/* =====================================================
            ORGANIZATIONS
        ===================================================== */}
        <Route
          path="/organizations"
          element={
            isAuthenticated ? (
              <AppLayout>
                <OrganizationsPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

'@

$content = $content.Replace($marker, $route + $marker)

Set-Content $path $content -Encoding utf8

        {/* =====================================================
            USERS
        ===================================================== */}
        <Route
          path="/users"
          element={
            isAuthenticated ? (
              <AppLayout>
                <UsersPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />


        {/* =====================================================
            SITES
        ===================================================== */}
        <Route
          path="/sites"
          element={
            isAuthenticated ? (
              <AppLayout>
                <SitesPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

<Route
  path="/areas"
  element={
    isAuthenticated ? (
      <AppLayout>
        <AreasPage />
      </AppLayout>
    ) : (
      <Navigate to="/login" replace />
    )
  }
/>

        {/* =====================================================
            ROOMS
        ===================================================== */}
        <Route
          path="/rooms"
          element={
            isAuthenticated ? (
              <AppLayout>
                <RoomsPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* =====================================================
            DEVICES
        ===================================================== */}
        <Route
          path="/devices"
          element={
            isAuthenticated ? (
              <AppLayout>
                <DevicesPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* =====================================================
            TICKETS
        ===================================================== */}
        <Route
          path="/tickets"
          element={
            isAuthenticated ? (
              <AppLayout>
                <TicketsPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* =====================================================
            DIAGNOSTICS
        ===================================================== */}
        <Route
          path="/diagnostics"
          element={
            isAuthenticated ? (
              <AppLayout>
                <DiagnosticsPage />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* =====================================================
            ROOT
        ===================================================== */}
        <Route
          path="/"
          element={
            <Navigate
              to={isAuthenticated ? '/dashboard' : '/login'}
              replace
            />
          }
        />

        {/* =====================================================
            UNKNOWN ROUTES
        ===================================================== */}
        <Route
          path="*"
          element={
            <Navigate
              to={isAuthenticated ? '/dashboard' : '/login'}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App