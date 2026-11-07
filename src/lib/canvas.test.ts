import { describe, expect, it } from 'vitest'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_SIZE,
  clamp,
  snapToGrid,
} from './canvas'

describe('canvas constants', () => {
  it('menetapkan ukuran kanvas dan grid yang dipakai editor', () => {
    expect(CANVAS_WIDTH).toBe(1000)
    expect(CANVAS_HEIGHT).toBe(640)
    expect(GRID_SIZE).toBe(20)
  })
})

describe('clamp', () => {
  it('mempertahankan nilai di dalam rentang', () => {
    expect(clamp(120, 0, 500)).toBe(120)
  })

  it('menahan nilai di batas bawah', () => {
    expect(clamp(-40, 0, 500)).toBe(0)
  })

  it('menahan nilai di batas atas', () => {
    expect(clamp(900, 0, 500)).toBe(500)
  })

  it('membatasi posisi booth agar tetap di dalam kanvas', () => {
    const boothWidth = 120
    const boothHeight = 100

    expect(clamp(-20, 0, CANVAS_WIDTH - boothWidth)).toBe(0)
    expect(clamp(1200, 0, CANVAS_WIDTH - boothWidth)).toBe(CANVAS_WIDTH - boothWidth)
    expect(clamp(700, 0, CANVAS_HEIGHT - boothHeight)).toBe(CANVAS_HEIGHT - boothHeight)
  })
})

describe('snapToGrid', () => {
  it('membulatkan ke kelipatan grid terdekat', () => {
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(9)).toBe(0)
    expect(snapToGrid(10)).toBe(20)
    expect(snapToGrid(29)).toBe(20)
    expect(snapToGrid(31)).toBe(40)
  })

  it('mendukung ukuran grid kustom', () => {
    expect(snapToGrid(13, 8)).toBe(16)
    expect(snapToGrid(3, 8)).toBe(0)
  })

  it('tetap menghasilkan koordinat kelipatan grid di tengah kanvas', () => {
    const snapped = snapToGrid(CANVAS_WIDTH / 3)

    expect(snapped % GRID_SIZE).toBe(0)
  })
})
