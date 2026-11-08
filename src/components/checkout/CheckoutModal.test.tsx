import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckoutModal from './CheckoutModal'
import type { Booth } from '../../types/booth'

function makeBooth(overrides: Partial<Booth> = {}): Booth {
  return {
    id: '11111111-1111-4111-8111-111111111101',
    blueprintId: 'hall-a',
    category: 'Tech',
    positionX: 10,
    positionY: 10,
    width: 120,
    height: 80,
    price: 4_500_000,
    status: 'Available',
    ...overrides,
  }
}

function renderModal(overrides: {
  booth?: Booth
  reserved?: boolean
  confirming?: boolean
  bookingCode?: string | null
} = {}) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  const onViewBookings = vi.fn()

  render(
    <CheckoutModal
      booth={overrides.booth ?? makeBooth()}
      eventName="Pameran Teknologi"
      reserved={overrides.reserved ?? false}
      bookingCode={overrides.bookingCode ?? null}
      confirming={overrides.confirming ?? false}
      onClose={onClose}
      onConfirm={onConfirm}
      onViewBookings={onViewBookings}
    />,
  )

  return { onClose, onConfirm, onViewBookings }
}

describe('CheckoutModal', () => {
  beforeEach(() => {
    // jsdom tidak menghitung layout, sehingga getClientRects selalu kosong.
    // Kembalikan satu rect agar focus trap dianggap memiliki elemen terlihat.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      { width: 10, height: 10 } as DOMRect,
    ] as unknown as DOMRectList)
  })

  it('merender dialog dan memfokuskan tombol tutup', () => {
    renderModal()

    expect(screen.getByRole('dialog', { name: 'Konfirmasi pemesanan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tutup dialog pemesanan' })).toHaveFocus()
  })

  it('menutup dialog saat Escape dan tidak sedang mengonfirmasi', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('tidak menutup saat Escape ketika sedang mengonfirmasi', () => {
    const { onClose } = renderModal({ confirming: true })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Membuat Pesanan…' })).toBeDisabled()
  })

  it('memutar fokus di dalam dialog', () => {
    renderModal()

    const close = screen.getByRole('button', { name: 'Tutup dialog pemesanan' })
    const confirm = screen.getByRole('button', { name: 'Buat Pesanan & Kunci Booth' })

    expect(close).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('mengirim metode pembayaran yang dipilih', () => {
    const { onConfirm } = renderModal()

    fireEvent.click(screen.getByRole('radio', { name: /QRIS/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Buat Pesanan & Kunci Booth' }))

    expect(onConfirm).toHaveBeenCalledWith('qris')
  })

  it('menutup dialog tanpa memesan saat booth tidak tersedia', () => {
    const { onClose, onConfirm } = renderModal({
      booth: makeBooth({ status: 'Reserved' }),
    })

    expect(screen.getByText('Tidak tersedia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Pilih booth lain' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('menampilkan ringkasan booth terkunci dan aksi lihat pesanan', () => {
    const { onViewBookings } = renderModal({
      reserved: true,
      bookingCode: 'BK-001',
    })

    expect(screen.getByRole('dialog', { name: 'Booth berhasil dikunci' })).toBeInTheDocument()
    expect(screen.getByText('BK-001')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Lihat Pesanan Saya' }))
    expect(onViewBookings).toHaveBeenCalledTimes(1)
  })
})
