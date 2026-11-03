import { create } from 'zustand'
import type { Booth } from '../types/booth'

export const DEFAULT_BLUEPRINT_ID = 'hall-a'

interface BoothStore {
  booths: Booth[]
  activeBoothId: string | null
  blueprintId: string
  isDirty: boolean
  setBooths: (booths: Booth[]) => void
  addBooth: (booth: Booth) => void
  updateBoothPosition: (id: string, x: number, y: number) => void
  setActiveBooth: (id: string | null) => void
  removeBooth: (id: string) => void
  markSaved: () => void
  resetBooths: () => void
}

export const useBoothStore = create<BoothStore>((set) => ({
  booths: [],
  activeBoothId: null,
  blueprintId: DEFAULT_BLUEPRINT_ID,
  isDirty: false,

  setBooths: (booths) =>
    set({
      booths,
      activeBoothId: null,
      isDirty: false,
    }),

  addBooth: (booth) =>
    set((state) => ({
      booths: [...state.booths, booth],
      activeBoothId: booth.id,
      isDirty: true,
    })),

  updateBoothPosition: (id, x, y) =>
    set((state) => ({
      booths: state.booths.map((booth) =>
        booth.id === id ? { ...booth, positionX: x, positionY: y } : booth,
      ),
      isDirty: true,
    })),

  setActiveBooth: (id) => set({ activeBoothId: id }),

  removeBooth: (id) =>
    set((state) => ({
      booths: state.booths.filter((booth) => booth.id !== id),
      activeBoothId: state.activeBoothId === id ? null : state.activeBoothId,
      isDirty: true,
    })),

  markSaved: () => set({ isDirty: false }),

  resetBooths: () =>
    set({
      booths: [],
      activeBoothId: null,
      isDirty: false,
    }),
}))
