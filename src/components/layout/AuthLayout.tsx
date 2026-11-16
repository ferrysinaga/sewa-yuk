import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[7px] bg-pine text-white ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
        <rect x="4" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="4" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  )
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[6px] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <BrandMark />
          <span className="text-base font-semibold tracking-tight text-ink">sewa-yuk</span>
        </Link>
        <Link
          to="/"
          className="rounded-[6px] text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
        >
          Beranda
        </Link>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-8 focus:outline-none sm:px-6 sm:py-10"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-line px-4 py-5 text-center text-xs text-muted sm:px-6">
        © 2026 sewa-yuk. Semua hak dilindungi.
      </footer>
    </div>
  )
}
