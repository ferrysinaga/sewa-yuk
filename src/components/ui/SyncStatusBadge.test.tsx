import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SyncStatusBadge from './SyncStatusBadge'

describe('SyncStatusBadge', () => {
  it('menampilkan status live tanpa aksi manual', () => {
    render(<SyncStatusBadge status="live" />)

    expect(screen.getByRole('status')).toHaveTextContent('Sinkron real-time')
    expect(screen.queryByRole('button', { name: 'Muat ulang data' })).not.toBeInTheDocument()
  })

  it('menampilkan status menghubungkan tanpa aksi manual', () => {
    render(<SyncStatusBadge status="connecting" />)

    expect(screen.getByRole('status')).toHaveTextContent('Menghubungkan…')
    expect(screen.queryByRole('button', { name: 'Muat ulang data' })).not.toBeInTheDocument()
  })

  it('menampilkan waktu terakhir dan tombol muat ulang saat terputus', () => {
    const onRefresh = vi.fn()
    const lastUpdatedAt = new Date('2026-11-07T10:30:00Z').getTime()

    render(
      <SyncStatusBadge
        status="disconnected"
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={onRefresh}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Koneksi terputus')
    expect(screen.getByText(/Terakhir diperbarui/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang data' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('menonaktifkan tombol saat sedang memuat ulang', () => {
    render(
      <SyncStatusBadge status="disconnected" onRefresh={() => {}} refreshing />,
    )

    expect(screen.getByRole('button', { name: 'Memuat…' })).toBeDisabled()
    expect(screen.getByText('Belum ada pembaruan')).toBeInTheDocument()
  })
})
