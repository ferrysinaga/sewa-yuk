import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_BLUEPRINT_ID, useBoothStore } from '../../store/useBoothStore'
import type { Booth } from '../../types/booth'
import InteractiveMap from './InteractiveMap'

const booth: Booth = {
  id: '11111111-1111-4111-8111-111111111101',
  blueprintId: DEFAULT_BLUEPRINT_ID,
  category: 'Tech',
  positionX: 100,
  positionY: 100,
  width: 160,
  height: 120,
  price: 4_500_000,
  status: 'Available',
}

beforeEach(() => {
  useBoothStore.setState({
    booths: [booth],
    activeBoothId: null,
    blueprintImageUrl: null,
    isDirty: false,
    deletedBoothIds: [],
  })
})

describe('InteractiveMap', () => {
  it('menandai pilihan tunggal dengan aria-current', () => {
    render(<InteractiveMap activeCategory="all" />)

    const boothButton = screen.getByRole('button', { name: /Booth Teknologi/ })

    expect(boothButton).not.toHaveAttribute('aria-current')

    fireEvent.click(boothButton)

    expect(boothButton).toHaveAttribute('aria-current', 'true')
    expect(useBoothStore.getState().activeBoothId).toBe(booth.id)
  })

  it('melepas pilihan dengan Escape dari luar booth', () => {
    render(<InteractiveMap activeCategory="all" />)

    const boothButton = screen.getByRole('button', { name: /Booth Teknologi/ })
    fireEvent.click(boothButton)
    expect(useBoothStore.getState().activeBoothId).toBe(booth.id)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(useBoothStore.getState().activeBoothId).toBeNull()
    expect(boothButton).not.toHaveAttribute('aria-current')
  })

  it('tidak melepas pilihan saat dialog checkout terbuka', () => {
    render(<InteractiveMap activeCategory="all" />)

    fireEvent.click(screen.getByRole('button', { name: /Booth Teknologi/ }))

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(useBoothStore.getState().activeBoothId).toBe(booth.id)

    dialog.remove()
  })

  it('menggeser peta dengan tombol panah setelah diperbesar', () => {
    render(<InteractiveMap activeCategory="all" />)

    const viewport = screen.getByRole('group', { name: 'Area peta booth' })

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 500 })

    fireEvent.click(screen.getByRole('button', { name: 'Perbesar peta' }))

    const transformLayer = viewport.querySelector('div')
    const before = transformLayer?.style.transform

    expect(before).toContain('scale(1.25)')

    fireEvent.keyDown(viewport, { key: 'ArrowRight' })

    expect(transformLayer?.style.transform).not.toBe(before)
  })
})
