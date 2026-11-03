import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

export default function AppHeader() {
  const session = useAuthStore((state) => state.session)
  const user = useAuthStore((state) => state.user)
  const role = useAuthStore((state) => state.role)
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || 'Pengguna'

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M9 9v11M15 9v11" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight text-gray-900">sewa-yuk</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi aplikasi">
            <Link
              to="/event"
              className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Jelajahi Event
            </Link>
            {role === 'organizer' && (
              <>
                <Link
                  to="/admin"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/blueprint"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Editor Denah
                </Link>
              </>
            )}
          </nav>
        </div>

        {session ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-sm font-medium text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-500">
                {role === 'organizer' ? 'Penyelenggara' : role === 'tenant' ? 'Penyewa' : 'Pengguna'}
              </p>
            </div>
            <span
              className={`hidden rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex ${
                role === 'organizer'
                  ? 'bg-blue-50 text-blue-700 ring-blue-100'
                  : 'bg-gray-100 text-gray-700 ring-gray-200'
              }`}
            >
              {role === 'organizer' ? 'Organizer' : 'Tenant'}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Keluar…' : 'Keluar'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Masuk
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Daftar
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
