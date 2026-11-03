export type BoothCategory = 'Tech' | 'F&B' | 'Apparel'
export type BoothStatus = 'Available' | 'Reserved' | 'Booked'

export interface Booth {
  id: string
  blueprintId: string
  category: BoothCategory
  positionX: number
  positionY: number
  width: number
  height: number
  price: number
  status: BoothStatus
}

export interface BoothTemplate {
  category: BoothCategory
  width: number
  height: number
  price: number
}
