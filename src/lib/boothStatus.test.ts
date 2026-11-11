import { describe, expect, it } from 'vitest'
import { rollbackRowStatus, setRowStatus } from './boothStatus'
import type { BoothStatus } from '../types/booth'

interface Row {
  id: string
  status: BoothStatus
  price: number
}

const rows: Row[] = [
  { id: 'booth-1', status: 'Available', price: 100 },
  { id: 'booth-2', status: 'Available', price: 200 },
]

describe('setRowStatus', () => {
  it('mengubah hanya baris yang dituju tanpa memutasi daftar asal', () => {
    const next = setRowStatus(rows, 'booth-1', 'Reserved')

    expect(next[0]).toMatchObject({ id: 'booth-1', status: 'Reserved' })
    expect(next[1]).toEqual(rows[1])
    expect(rows[0].status).toBe('Available')
  })
})

describe('rollbackRowStatus', () => {
  it('mengembalikan status sebelumnya saat baris masih optimistis', () => {
    const optimistic = setRowStatus(rows, 'booth-1', 'Reserved')
    const rolledBack = rollbackRowStatus(optimistic, 'booth-1', 'Reserved', 'Available')

    expect(rolledBack[0].status).toBe('Available')
    expect(rolledBack[1].status).toBe('Available')
  })

  it('tidak menimpa status yang sudah diubah server', () => {
    const serverWon = setRowStatus(rows, 'booth-1', 'Booked')
    const rolledBack = rollbackRowStatus(serverWon, 'booth-1', 'Reserved', 'Available')

    expect(rolledBack[0].status).toBe('Booked')
  })
})
