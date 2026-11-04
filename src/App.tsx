import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LandingPage from './pages/landing/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/admin/AdminDashboard'
import BlueprintEditor from './pages/admin/BlueprintEditor'
import BlueprintList from './pages/admin/BlueprintList'
import EventExplorer from './pages/tenant/EventExplorer'
import TenantEventView from './pages/tenant/TenantEventView'
import { useAuthStore } from './store/useAuthStore'

function AppRoutes() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/event" element={<EventExplorer />} />
      <Route path="/event/:eventId" element={<TenantEventView />} />

      <Route element={<ProtectedRoute allowedRoles={['organizer']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/blueprint" element={<BlueprintList />} />
        <Route path="/admin/blueprint/:blueprintId" element={<BlueprintEditor />} />
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  )
}
