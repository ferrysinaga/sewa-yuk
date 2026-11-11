import { Link } from 'react-router-dom'
import { BrandMark } from '../LandingIcons'
import { navItems } from '../landingContent'

export default function LandingFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8" />
            <div>
              <p className="text-sm font-semibold text-ink">sewa-yuk</p>
              <p className="text-compact text-muted">Peta booth untuk acara yang lebih rapi.</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Navigasi footer">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-chip text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              className="rounded-chip text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Masuk
            </Link>
          </nav>

          <p className="text-xs text-muted">© 2026 sewa-yuk. Semua hak dilindungi.</p>
        </div>
      </div>
    </footer>
  )
}
