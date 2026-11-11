import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BLUEPRINT_ID, useBoothStore } from '../../store/useBoothStore'
import type { Booth } from '../../types/booth'
import BlueprintCanvas from './BlueprintCanvas'

const { dragKeyDown } = vi.hoisted(() => ({ dragKeyDown: vi.fn() }))

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {
      role: 'button',
      tabIndex: 0,
      'aria-roledescription': 'draggable',
    },
    listeners: { onKeyDown: dragKeyDown },
    setNodeRef: () => {},
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
  }),
}))

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
  dragKeyDown.mockClear()
  useBoothStore.setState({
    booths: [booth],
    activeBoothId: null,
    blueprintImageUrl: null,
    isDirty: false,
    deletedBoothIds: [],
  })
})

describe('BlueprintCanvas keyboard', () => {
  it('memilih booth dengan Enter tanpa memulai drag', () => {
    render(<BlueprintCanvas svgRef={createRef<SVGSVGElement>()} />)

    const boothButton = screen.getByRole('button', { name: /Booth Tech/ })
    fireEvent.keyDown(boothButton, { key: 'Enter' })

    expect(useBoothStore.getState().activeBoothId).toBe(booth.id)
    expect(dragKeyDown).not.toHaveBeenCalled()
  })

  it('memakai Space untuk memindahkan booth lewat sensor dnd-kit', () => {
    render(<BlueprintCanvas svgRef={createRef<SVGSVGElement>()} />)

    const boothButton = screen.getByRole('button', { name: /Booth Tech/ })
    fireEvent.keyDown(boothButton, { key: ' ' })

    expect(dragKeyDown).toHaveBeenCalledTimes(1)
  })

  it('menandai pilihan dengan aria-current dan melepasnya dengan Escape', () => {
    render(<BlueprintCanvas svgRef={createRef<SVGSVGElement>()} />)

    const boothButton = screen.getByRole('button', { name: /Booth Tech/ })
    fireEvent.click(boothButton)

    expect(boothButton).toHaveAttribute('aria-current', 'true')

    fireEvent.keyDown(boothButton, { key: 'Escape' })

    expect(useBoothStore.getState().activeBoothId).toBeNull()
    expect(boothButton).not.toHaveAttribute('aria-current')
  })
})
