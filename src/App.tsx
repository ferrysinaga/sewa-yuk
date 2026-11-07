import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppErrorBoundary from './components/layout/AppErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/layout/ProtectedRoute'
import { useAuthStore } from './store/useAuthStore'

// Halaman dipecah per route agar bundle awal tidak memuat seluruh layar
// admin/tenant sekaligus. Fallback dibuat statis dan tenang (tanpa pulse).
const LandingPage = lazy(() => import('./pages/landing/LandingPage'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'))
const BlueprintEditor = lazy(() => import('./pages/admin/BlueprintEditor'))
const BlueprintList = lazy(() => import('./pages/admin/BlueprintList'))
const EventExplorer = lazy(() => import('./pages/tenant/EventExplorer'))
const TenantBookings = lazy(() => import('./pages/tenant/TenantBookings'))
const TenantEventView = lazy(() => import('./pages/tenant/TenantEventView'))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-xs rounded-[10px] border border-line bg-surface px-6 py-8 text-center"
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-10 bg-clay" />
        <p className="mt-4 text-sm font-medium text-ink">Memuat halaman…</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Menyiapkan tampilan yang Anda minta.
        </p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/event" element={<EventExplorer />} />
        <Route path="/event/:eventId" element={<TenantEventView />} />

        <Route element={<ProtectedRoute allowedRoles={['tenant']} />}>
          <Route path="/bookings" element={<TenantBookings />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['organizer']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/admin/blueprint" element={<BlueprintList />} />
          <Route path="/admin/blueprint/:blueprintId" element={<BlueprintEditor />} />
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppErrorBoundary>
          <AppRoutes />
        </AppErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  )
}
