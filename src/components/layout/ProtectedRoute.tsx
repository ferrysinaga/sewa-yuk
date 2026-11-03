import { Navigate, Outlet, useLocation } from 'react-router-dom'
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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
          />
          <p className="text-sm text-gray-500">Memeriksa sesi Anda…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />
  }

  return <Outlet />
}
