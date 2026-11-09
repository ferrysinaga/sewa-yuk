import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyPanel, ErrorPanel, LoadingPanel } from './StatePanel'

describe('LoadingPanel', () => {
  it('mengumumkan status loading dengan role status', () => {
    render(<LoadingPanel title="Memuat data…" description="Mengambil data terbaru." />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Memuat data…')
    expect(status).toHaveTextContent('Mengambil data terbaru.')
  })

  it('mendukung varian bare untuk halaman penuh', () => {
    render(<LoadingPanel variant="bare" className="" title="Memeriksa sesi…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Memeriksa sesi…')
  })
})

describe('ErrorPanel', () => {
  it('mengumumkan error dan menjalankan retry', () => {
    const onRetry = vi.fn()

    render(
      <ErrorPanel title="Gagal memuat data" description="Koneksi terputus." onRetry={onRetry} />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Gagal memuat data')
    expect(screen.getByRole('alert')).toHaveTextContent('Koneksi terputus.')

    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('menyembunyikan ikon dan menampilkan aksi sekunder', () => {
    render(
      <ErrorPanel
        title="Gagal memuat"
        description="Coba lagi nanti."
        onRetry={() => {}}
        showIcon={false}
        secondaryAction={<a href="/kembali">Kembali</a>}
      />,
    )

    expect(screen.getByRole('link', { name: 'Kembali' })).toBeInTheDocument()
  })

  it('mendukung varian inline dengan teks gabungan', () => {
    const onRetry = vi.fn()

    render(
      <ErrorPanel
        variant="inline"
        title="Gagal memuat denah"
        description="Batas waktu habis."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Gagal memuat denah: Batas waktu habis.')

    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('EmptyPanel', () => {
  it('menampilkan judul, deskripsi, dan aksi', () => {
    render(
      <EmptyPanel
        title="Belum ada data"
        description="Tambahkan data pertama."
        action={<button type="button">Tambah data</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Belum ada data' })).toBeInTheDocument()
    expect(screen.getByText('Tambahkan data pertama.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah data' })).toBeInTheDocument()
  })

  it('mendukung ikon daftar dan judul ringkas sebagai paragraf', () => {
    const { container } = render(
      <EmptyPanel compact titleAs="p" title="Tidak ada hasil" description="Ubah kata kunci." />,
    )

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText('Tidak ada hasil')).toBeInTheDocument()

    const withIcon = render(
      <EmptyPanel icon="list" title="Belum ada denah" description="Buat denah pertama." />,
    )

    expect(withIcon.container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
