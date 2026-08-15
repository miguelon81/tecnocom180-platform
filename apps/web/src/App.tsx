import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SitesPage from './pages/SitesPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/sites" replace />} />
        <Route path="/sites" element={<SitesPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
