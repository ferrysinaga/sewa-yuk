import { create } from 'zustand'
import type { BlueprintDraft } from '../types/blueprint'
import type { Booth, BoothCategory, BoothStatus } from '../types/booth'

export const DEFAULT_BLUEPRINT_ID = 'hall-a'

export interface BoothDetailsPatch {
  category?: BoothCategory
  price?: number
}

interface BoothStore {
  booths: Booth[]
  activeBoothId: string | null
  blueprintId: string
  blueprintDraft: BlueprintDraft | null
  blueprintImageUrl: string | null
  isDirty: boolean
  deletedBoothIds: string[]
  setBooths: (booths: Booth[], imageUrl?: string | null) => void
  loadBlueprint: (blueprintId: string, booths: Booth[], draft: BlueprintDraft) => void
  setBlueprintDraft: (draft: BlueprintDraft) => void
  addBooth: (booth: Booth) => void
  updateBoothPosition: (id: string, x: number, y: number) => void
  updateBoothDetails: (id: string, patch: BoothDetailsPatch) => void
  updateBoothStatus: (id: string, status: BoothStatus) => void
  setActiveBooth: (id: string | null) => void
  removeBooth: (id: string) => void
  markSaved: () => void
  resetBooths: () => void
}

export const useBoothStore = create<BoothStore>((set) => ({
  booths: [],
  activeBoothId: null,
  blueprintId: DEFAULT_BLUEPRINT_ID,
  blueprintDraft: null,
  blueprintImageUrl: null,
  isDirty: false,
  deletedBoothIds: [],

  setBooths: (booths, imageUrl = null) =>
    set({
      booths,
      blueprintImageUrl: imageUrl,
      activeBoothId: null,
      isDirty: false,
      deletedBoothIds: [],
    }),

  loadBlueprint: (blueprintId, booths, draft) =>
    set({
      blueprintId,
      blueprintDraft: draft,
      blueprintImageUrl: draft.imageUrl || null,
      booths,
      activeBoothId: null,
      isDirty: false,
      deletedBoothIds: [],
    }),

  setBlueprintDraft: (draft) =>
    set({
      blueprintDraft: draft,
      blueprintImageUrl: draft.imageUrl || null,
      isDirty: true,
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

  updateBoothDetails: (id, patch) =>
    set((state) => ({
      booths: state.booths.map((booth) =>
        booth.id === id
          ? {
              ...booth,
              ...patch,
              price:
                patch.price !== undefined && Number.isFinite(patch.price)
                  ? Math.max(0, Math.round(patch.price))
                  : booth.price,
            }
          : booth,
      ),
      isDirty: true,
    })),

  updateBoothStatus: (id, status) =>
    set((state) => ({
      booths: state.booths.map((booth) => (booth.id === id ? { ...booth, status } : booth)),
    })),

  setActiveBooth: (id) => set({ activeBoothId: id }),

  removeBooth: (id) =>
    set((state) => ({
      booths: state.booths.filter((booth) => booth.id !== id),
      activeBoothId: state.activeBoothId === id ? null : state.activeBoothId,
      isDirty: true,
      deletedBoothIds: state.deletedBoothIds.includes(id)
        ? state.deletedBoothIds
        : [...state.deletedBoothIds, id],
    })),

  markSaved: () => set({ isDirty: false, deletedBoothIds: [] }),

  resetBooths: () =>
    set({
      booths: [],
      activeBoothId: null,
      blueprintDraft: null,
      blueprintImageUrl: null,
      isDirty: false,
      deletedBoothIds: [],
    }),
}))
