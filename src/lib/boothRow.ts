import type { Booth, BoothCategory, BoothStatus } from '../types/booth'

export interface BoothRow {
  id: string
  blueprint_id: string
  category: BoothCategory
  position_x: number
  position_y: number
  width: number
  height: number
  price: number
  status: BoothStatus
}

export function mapRowToBooth(row: BoothRow): Booth {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    category: row.category,
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    price: row.price,
    status: row.status,
  }
}

export function isCompleteBoothRow(row: Partial<BoothRow>): row is BoothRow {
  return (
    typeof row.id === 'string' &&
    typeof row.blueprint_id === 'string' &&
    (row.category === 'Tech' || row.category === 'F&B' || row.category === 'Apparel') &&
    typeof row.position_x === 'number' &&
    typeof row.position_y === 'number' &&
    typeof row.width === 'number' &&
    typeof row.height === 'number' &&
    typeof row.price === 'number' &&
    (row.status === 'Available' || row.status === 'Reserved' || row.status === 'Booked')
  )
}
