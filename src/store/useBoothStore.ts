import { create } from 'zustand'
import type { BlueprintDraft } from '../types/blueprint'
import type { Booth, BoothCategory, BoothStatus } from '../types/booth'

export const DEFAULT_BLUEPRINT_ID = 'hall-a'

function toStatusBaseline(booths: Booth[]): Record<string, BoothStatus> {
  return Object.fromEntries(booths.map((booth) => [booth.id, booth.status]))
}

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
  // Status booth terakhir yang tersimpan di database. Dipakai editor agar
  // penyimpanan denah hanya menulis status yang benar-benar diubah organizer,
  // tanpa menimpa Reserved/Booked dari penyewa.
  boothStatusBaseline: Record<string, BoothStatus>
  setBooths: (booths: Booth[], imageUrl?: string | null) => void
  loadBlueprint: (blueprintId: string, booths: Booth[], draft: BlueprintDraft) => void
  setBlueprintDraft: (draft: BlueprintDraft) => void
  addBooth: (booth: Booth) => void
  updateBoothPosition: (id: string, x: number, y: number) => void
  updateBoothDetails: (id: string, patch: BoothDetailsPatch) => void
  updateBoothStatus: (id: string, status: BoothStatus) => void
  replaceRealtimeBooths: (booths: Booth[]) => void
  upsertRealtimeBooth: (booth: Booth) => void
  removeRealtimeBooth: (id: string) => void
  markDirty: () => void
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
  boothStatusBaseline: {},

  setBooths: (booths, imageUrl = null) =>
    set({
      booths,
      blueprintImageUrl: imageUrl,
      activeBoothId: null,
      isDirty: false,
      deletedBoothIds: [],
      boothStatusBaseline: toStatusBaseline(booths),
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
      boothStatusBaseline: toStatusBaseline(booths),
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

  // Dipakai saat reconnect untuk mengganti seluruh daftar tanpa menandai denah
  // sebagai "belum disimpan" dan tanpa kehilangan pilihan booth yang masih ada.
  replaceRealtimeBooths: (booths) =>
    set((state) => ({
      booths,
      activeBoothId:
        state.activeBoothId && booths.some((booth) => booth.id === state.activeBoothId)
          ? state.activeBoothId
          : null,
    })),

  // Dipakai oleh kanvas tenant saat menerima event Realtime. Booth baru atau
  // perubahan dari organizer tidak boleh menandai denah sebagai "belum
  // disimpan" atau mengubah pilihan booth yang sedang aktif.
  upsertRealtimeBooth: (booth) =>
    set((state) => {
      const exists = state.booths.some((item) => item.id === booth.id)

      return {
        booths: exists
          ? state.booths.map((item) => (item.id === booth.id ? booth : item))
          : [...state.booths, booth],
      }
    }),

  removeRealtimeBooth: (id) =>
    set((state) => ({
      booths: state.booths.filter((booth) => booth.id !== id),
      activeBoothId: state.activeBoothId === id ? null : state.activeBoothId,
    })),

  markDirty: () => set({ isDirty: true }),

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

  markSaved: () =>
    set((state) => ({
      isDirty: false,
      deletedBoothIds: [],
      boothStatusBaseline: toStatusBaseline(state.booths),
    })),

  resetBooths: () =>
    set({
      booths: [],
      activeBoothId: null,
      blueprintDraft: null,
      blueprintImageUrl: null,
      isDirty: false,
      deletedBoothIds: [],
      boothStatusBaseline: {},
    }),
}))
