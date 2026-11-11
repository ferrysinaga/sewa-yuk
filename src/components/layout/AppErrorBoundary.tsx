import { Component, createRef } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import {
  clearChunkReloadMarker,
  getSessionStorage,
  hasChunkReloadAttempted,
  isChunkLoadError,
  markChunkReloadAttempted,
} from '../../lib/chunkRecovery'

interface AppErrorBoundaryProps {
  children: ReactNode
  /** Dapat diganti saat pengujian; default memuat ulang halaman. */
  reloadPage?: () => void
}

interface AppErrorBoundaryState {
  error: Error | null
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  private headingRef = createRef<HTMLHeadingElement>()
  private reloadRequested = false

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidMount() {
    // Jangan hapus penanda saat yang dirender justru fallback error; hanya
    // halaman yang benar-benar pulih boleh mengizinkan auto-reload lagi.
    if (this.state.error) {
      this.focusHeading()
      return
    }

    clearChunkReloadMarker(getSessionStorage())
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error tertangkap oleh AppErrorBoundary.', error, info.componentStack)

    if (!isChunkLoadError(error)) return
    if (this.reloadRequested) return

    if (markChunkReloadAttempted(getSessionStorage())) {
      this.reloadRequested = true
      this.reloadPage()
    }
  }

  componentDidUpdate(_props: AppErrorBoundaryProps, prevState: AppErrorBoundaryState) {
    // Pindahkan fokus ke judul fallback agar pembaca layar langsung tahu
    // halaman berubah, tanpa memindahkan fokus saat render normal.
    if (!prevState.error && this.state.error) {
      this.focusHeading()
    }
  }

  private focusHeading() {
    this.headingRef.current?.focus()
  }

  reloadPage = () => {
    if (this.props.reloadPage) {
      this.props.reloadPage()
      return
    }

    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const chunkError = isChunkLoadError(error)
    const reloadAttempted = hasChunkReloadAttempted(getSessionStorage())

    const title = chunkError
      ? reloadAttempted
        ? 'Halaman belum dapat dimuat'
        : 'Versi aplikasi mungkin diperbarui'
      : 'Terjadi kesalahan'

    const description = chunkError
      ? reloadAttempted
        ? 'Versi terbaru masih gagal dimuat. Periksa koneksi, lalu muat ulang secara manual.'
        : 'Halaman ini memuat versi lama. Muat ulang untuk mengambil versi terbaru.'
      : 'Halaman gagal ditampilkan. Data Anda tetap aman. Muat ulang halaman atau kembali ke beranda untuk melanjutkan.'

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 sm:px-6">
        <section
          role="alert"
          className="w-full max-w-md rounded-card border border-line bg-surface p-6 sm:p-8"
        >
          <span aria-hidden="true" className="block h-1 w-10 bg-clay" />
          <p className="mt-4 text-compact font-semibold uppercase tracking-[0.16em] text-muted">
            Pemulihan halaman
          </p>
          <h1
            ref={this.headingRef}
            tabIndex={-1}
            className="mt-2 text-xl font-semibold tracking-[-0.01em] text-ink focus-visible:outline-none"
          >
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={this.reloadPage}
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-pine px-5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Muat ulang
            </button>
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-unavailable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Kembali ke beranda
            </a>
          </div>
        </section>
      </div>
    )
  }
}
