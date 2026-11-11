import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { CHUNK_RELOAD_KEY } from '../../lib/chunkRecovery'
import AppErrorBoundary from './AppErrorBoundary'

function ThrowError({ error }: { error: Error }): ReactNode {
  throw error
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('menampilkan fallback yang dapat dioperasikan keyboard', () => {
    const reloadPage = vi.fn()

    render(
      <AppErrorBoundary reloadPage={reloadPage}>
        <ThrowError error={new Error('render gagal')} />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Terjadi kesalahan' })).toBeInTheDocument()
    expect(reloadPage).not.toHaveBeenCalled()

    const reloadButton = screen.getByRole('button', { name: 'Muat ulang' })
    reloadButton.focus()
    expect(reloadButton).toHaveFocus()

    fireEvent.click(reloadButton)
    expect(reloadPage).toHaveBeenCalledTimes(1)

    expect(screen.getByRole('link', { name: 'Kembali ke beranda' })).toHaveAttribute('href', '/')
  })

  it('memindahkan fokus ke judul fallback saat render error', () => {
    render(
      <AppErrorBoundary reloadPage={vi.fn()}>
        <ThrowError error={new Error('render gagal')} />
      </AppErrorBoundary>,
    )

    const heading = screen.getByRole('heading', { name: 'Terjadi kesalahan' })
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(heading).toHaveFocus()
  })

  it('memuat ulang otomatis satu kali saat chunk gagal dimuat', () => {
    const reloadPage = vi.fn()
    const chunkError = new Error('Failed to fetch dynamically imported module: /assets/admin.js')

    const { unmount } = render(
      <AppErrorBoundary reloadPage={reloadPage}>
        <ThrowError error={chunkError} />
      </AppErrorBoundary>,
    )

    expect(reloadPage).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1')

    unmount()

    render(
      <AppErrorBoundary reloadPage={reloadPage}>
        <ThrowError error={chunkError} />
      </AppErrorBoundary>,
    )

    expect(reloadPage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Halaman belum dapat dimuat' })).toBeInTheDocument()
    expect(screen.getByText(/Versi terbaru masih gagal dimuat/i)).toBeInTheDocument()
  })

  it('menampilkan copy versi baru saat chunk gagal pertama kali', () => {
    render(
      <AppErrorBoundary reloadPage={vi.fn()}>
        <ThrowError error={new Error('Importing a module script failed.')} />
      </AppErrorBoundary>,
    )

    expect(
      screen.getByRole('heading', { name: 'Versi aplikasi mungkin diperbarui' }),
    ).toBeInTheDocument()
  })

  it('tidak memuat ulang otomatis untuk render error biasa', () => {
    const reloadPage = vi.fn()

    render(
      <AppErrorBoundary reloadPage={reloadPage}>
        <ThrowError error={new Error('render gagal')} />
      </AppErrorBoundary>,
    )

    expect(reloadPage).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull()
  })

  it('menghapus penanda setelah halaman berhasil dimuat', () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')

    render(
      <AppErrorBoundary reloadPage={vi.fn()}>
        <p>Halaman aman</p>
      </AppErrorBoundary>,
    )

    expect(screen.getByText('Halaman aman')).toBeInTheDocument()
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull()
  })
})
