import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InlineConfirm from './InlineConfirm'

function Harness({ onConfirm }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Batalkan pesanan
      </button>
      {open && (
        <InlineConfirm
          id="confirm-test"
          title="Batalkan pesanan?"
          description="Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Ya, batalkan"
          onConfirm={() => {
            onConfirm?.()
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}

describe('InlineConfirm', () => {
  it('memakai role alertdialog dan memfokuskan tombol Batal', () => {
    render(
      <InlineConfirm
        id="confirm-static"
        title="Hapus data?"
        description="Data akan hilang."
        confirmLabel="Hapus"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: 'Hapus data?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batal' })).toHaveFocus()
  })

  it('membatalkan saat Escape ditekan', () => {
    const onCancel = vi.fn()

    render(
      <InlineConfirm
        id="confirm-escape"
        title="Batalkan?"
        description="Pilih salah satu."
        confirmLabel="Ya"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('memutar fokus dari tombol terakhir ke tombol pertama', () => {
    render(
      <InlineConfirm
        id="confirm-tab"
        title="Batalkan?"
        description="Pilih salah satu."
        confirmLabel="Ya"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    const cancel = screen.getByRole('button', { name: 'Batal' })
    const confirm = screen.getByRole('button', { name: 'Ya' })

    expect(cancel).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab' })
    expect(confirm).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab', shiftKey: true })
    expect(cancel).toHaveFocus()
  })

  it('mengembalikan fokus ke pemicu setelah panel ditutup', () => {
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Batalkan pesanan' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('button', { name: 'Batal' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(trigger).toHaveFocus()
  })

  it('menjalankan konfirmasi dan menutup panel', () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: 'Batalkan pesanan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
