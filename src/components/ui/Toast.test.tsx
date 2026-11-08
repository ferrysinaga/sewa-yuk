import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

type ToastVariant = 'success' | 'error' | 'info'

function Trigger({ message, variant }: { message: string; variant?: ToastVariant }) {
  const { showToast } = useToast()

  return (
    <button type="button" onClick={() => showToast(message, variant)}>
      Tampilkan notifikasi
    </button>
  )
}

function renderToast(message: string, variant?: ToastVariant) {
  return render(
    <ToastProvider>
      <Trigger message={message} variant={variant} />
    </ToastProvider>,
  )
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('menampilkan notifikasi info dengan role status', () => {
    renderToast('Data tersimpan.')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))

    expect(screen.getByRole('status')).toHaveTextContent('Data tersimpan.')
  })

  it('memakai role alert untuk notifikasi error', () => {
    renderToast('Gagal menyimpan.', 'error')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Gagal menyimpan.')
  })

  it('menghapus notifikasi otomatis setelah 5 detik', () => {
    vi.useFakeTimers()
    renderToast('Akan hilang.')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))
    expect(screen.getByText('Akan hilang.')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByText('Akan hilang.')).not.toBeInTheDocument()
  })

  it('dapat ditutup manual sebelum batas waktu', () => {
    renderToast('Tutup saya.')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tutup notifikasi' }))

    expect(screen.queryByText('Tutup saya.')).not.toBeInTheDocument()
  })

  it('tidak menghapus notifikasi error secara otomatis', () => {
    vi.useFakeTimers()
    renderToast('Gagal menyimpan.', 'error')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Gagal menyimpan.')
  })

  it('membersihkan timer saat notifikasi ditutup manual', () => {
    vi.useFakeTimers()
    renderToast('Tutup saya.')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))
    expect(vi.getTimerCount()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Tutup notifikasi' }))
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByText('Tutup saya.')).not.toBeInTheDocument()
  })

  it('membersihkan timer saat provider dilepas', () => {
    vi.useFakeTimers()
    const { unmount } = renderToast('Sementara.')

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan notifikasi' }))
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('menampilkan maksimal tiga notifikasi dan melepas yang tertua', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger message="Pertama" />
        <Trigger message="Kedua" />
        <Trigger message="Ketiga" />
        <Trigger message="Keempat" />
      </ToastProvider>,
    )

    screen
      .getAllByRole('button', { name: 'Tampilkan notifikasi' })
      .forEach((button) => fireEvent.click(button))

    expect(screen.queryByText('Pertama')).not.toBeInTheDocument()
    expect(screen.getByText('Kedua')).toBeInTheDocument()
    expect(screen.getByText('Ketiga')).toBeInTheDocument()
    expect(screen.getByText('Keempat')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(3)
  })

  it('menampilkan beberapa notifikasi sekaligus', () => {
    render(
      <ToastProvider>
        <Trigger message="Pertama" />
        <Trigger message="Kedua" />
      </ToastProvider>,
    )

    const buttons = screen.getAllByRole('button', { name: 'Tampilkan notifikasi' })
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])

    expect(screen.getByText('Pertama')).toBeInTheDocument()
    expect(screen.getByText('Kedua')).toBeInTheDocument()
  })
})
