import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingPanel } from '../ui/StatePanel'
import { useAuthStore } from '../../store/useAuthStore'
import { getDefaultRouteForRole } from '../../lib/auth'
import type { UserRole } from '../../types/auth'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const session = useAuthStore((state) => state.session)
  const role = useAuthStore((state) => state.role)
  const loading = useAuthStore((state) => state.loading)
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <LoadingPanel
          variant="bare"
          className=""
          title="Memeriksa sesi Anda…"
          titleClassName="text-sm text-muted"
        />
      </div>
    )
  }

  if (!session) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />
  }

  return <Outlet />
}
