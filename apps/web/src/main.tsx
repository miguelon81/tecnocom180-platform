import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { SiteProvider } from './sites/SiteContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SiteProvider>
        <App />
      </SiteProvider>
    </AuthProvider>
  </StrictMode>,
)