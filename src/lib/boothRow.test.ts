import { describe, expect, it } from 'vitest'
import { isCompleteBoothRow, mapRowToBooth } from './boothRow'
import type { BoothRow } from './boothRow'

const boothRow: BoothRow = {
  id: 'booth-1',
  blueprint_id: 'hall-a',
  category: 'Tech',
  position_x: 120,
  position_y: 80,
  width: 160,
  height: 120,
  price: 4_500_000,
  status: 'Available',
}

describe('mapRowToBooth', () => {
  it('memetakan seluruh kolom snake_case ke bentuk Booth', () => {
    expect(mapRowToBooth(boothRow)).toEqual({
      id: 'booth-1',
      blueprintId: 'hall-a',
      category: 'Tech',
      positionX: 120,
      positionY: 80,
      width: 160,
      height: 120,
      price: 4_500_000,
      status: 'Available',
    })
  })
})

describe('isCompleteBoothRow', () => {
  it('menerima row lengkap dengan status valid', () => {
    expect(isCompleteBoothRow(boothRow)).toBe(true)
    expect(isCompleteBoothRow({ ...boothRow, status: 'Reserved' })).toBe(true)
    expect(isCompleteBoothRow({ ...boothRow, status: 'Booked' })).toBe(true)
  })

  it('menolak row parsial yang kehilangan kolom wajib', () => {
    const withoutWidth: Partial<BoothRow> = { ...boothRow }
    delete withoutWidth.width

    expect(isCompleteBoothRow(withoutWidth)).toBe(false)
    expect(isCompleteBoothRow({ id: 'booth-1', status: 'Available' })).toBe(false)
    expect(isCompleteBoothRow({})).toBe(false)
  })

  it('menolak kategori atau status di luar nilai yang dikenal', () => {
    expect(isCompleteBoothRow({ ...boothRow, category: 'Lainnya' as never })).toBe(false)
    expect(isCompleteBoothRow({ ...boothRow, status: 'Unknown' as never })).toBe(false)
  })
})
