import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import type { UserRole } from '../../types/auth'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-[6px] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none ${
    isActive ? 'bg-pine-soft text-pine' : 'text-muted hover:bg-pine-soft hover:text-ink'
  }`

function AppNavLinks({ role }: { role: UserRole | null }) {
  return (
    <>
      <NavLink to="/event" className={navLinkClass}>
        Jelajahi event
      </NavLink>
      {role === 'tenant' && (
        <NavLink to="/bookings" className={navLinkClass}>
          Pesanan Saya
        </NavLink>
      )}
      {role === 'organizer' && (
        <>
          <NavLink to="/admin" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/bookings" className={navLinkClass}>
            Pemesanan
          </NavLink>
          <NavLink to="/admin/blueprint" className={navLinkClass}>
            Kelola Denah
          </NavLink>
        </>
      )}
    </>
  )
}

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
    <header className="sticky top-0 z-50 border-b border-line bg-canvas">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-pine text-white">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
                <rect x="4" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
                <rect x="13" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
                <rect x="4" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
                <rect x="13" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink">sewa-yuk</span>
              <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted sm:block">
                Peta booth pameran
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi aplikasi">
            <AppNavLinks role={role} />
          </nav>
        </div>

        {session ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-sm font-medium text-ink">{displayName}</p>
              <p className="text-xs text-muted">
                {role === 'organizer' ? 'Penyelenggara' : role === 'tenant' ? 'Penyewa' : 'Pengguna'}
              </p>
            </div>
            <span
              className={`hidden items-center rounded-[4px] border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${
                role === 'organizer'
                  ? 'border-line bg-pine-soft text-pine'
                  : 'border-line bg-canvas text-muted'
              }`}
            >
              {role === 'organizer' ? 'Penyelenggara' : 'Penyewa'}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              {signingOut ? 'Keluar…' : 'Keluar'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-[6px] px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Masuk
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-[6px] bg-pine px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Daftar
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-line md:hidden">
        <nav
          aria-label="Navigasi aplikasi"
          className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6"
        >
          <AppNavLinks role={role} />
        </nav>
      </div>
    </header>
  )
}
