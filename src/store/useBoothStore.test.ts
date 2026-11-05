import { beforeEach, describe, expect, it } from 'vitest'
import type { BlueprintDraft } from '../types/blueprint'
import type { Booth } from '../types/booth'
import { DEFAULT_BLUEPRINT_ID, useBoothStore } from './useBoothStore'

const blueprintDraft: BlueprintDraft = {
  name: 'Hall A',
  venue: 'Jakarta Convention Center',
  eventDate: '2026-11-20',
  description: 'Pameran teknologi',
  status: 'draft',
  imageUrl: '',
  imagePath: '',
}

function createBooth(overrides: Partial<Booth> = {}): Booth {
  return {
    id: 'booth-1',
    blueprintId: DEFAULT_BLUEPRINT_ID,
    category: 'Tech',
    positionX: 0,
    positionY: 0,
    width: 120,
    height: 120,
    price: 150_000,
    status: 'Available',
    ...overrides,
  }
}

function resetStore() {
  useBoothStore.setState({
    booths: [],
    activeBoothId: null,
    blueprintId: DEFAULT_BLUEPRINT_ID,
    blueprintDraft: null,
    blueprintImageUrl: null,
    isDirty: false,
    deletedBoothIds: [],
  })
}

beforeEach(() => {
  resetStore()
})

describe('addBooth', () => {
  it('menambahkan booth, memilihnya, dan menandai denah berubah', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)

    const state = useBoothStore.getState()
    expect(state.booths).toEqual([booth])
    expect(state.activeBoothId).toBe(booth.id)
    expect(state.isDirty).toBe(true)
  })

  it('mempertahankan booth yang sudah ada saat menambah booth baru', () => {
    const first = createBooth({ id: 'booth-1' })
    const second = createBooth({ id: 'booth-2', category: 'F&B' })

    useBoothStore.getState().addBooth(first)
    useBoothStore.getState().addBooth(second)

    const state = useBoothStore.getState()
    expect(state.booths).toHaveLength(2)
    expect(state.booths.map((booth) => booth.id)).toEqual(['booth-1', 'booth-2'])
    expect(state.activeBoothId).toBe('booth-2')
  })
})

describe('removeBooth', () => {
  it('menghapus booth dan mencatat id untuk sinkronisasi', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().removeBooth(booth.id)

    const state = useBoothStore.getState()
    expect(state.booths).toEqual([])
    expect(state.activeBoothId).toBeNull()
    expect(state.deletedBoothIds).toEqual([booth.id])
    expect(state.isDirty).toBe(true)
  })

  it('tidak menduplikasi id booth yang dihapus berulang kali', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().removeBooth(booth.id)
    useBoothStore.getState().removeBooth(booth.id)

    expect(useBoothStore.getState().deletedBoothIds).toEqual([booth.id])
  })

  it('mempertahankan pilihan booth lain saat booth yang tidak aktif dihapus', () => {
    const first = createBooth({ id: 'booth-1' })
    const second = createBooth({ id: 'booth-2' })

    useBoothStore.getState().addBooth(first)
    useBoothStore.getState().addBooth(second)
    useBoothStore.getState().removeBooth(first.id)

    const state = useBoothStore.getState()
    expect(state.booths.map((booth) => booth.id)).toEqual(['booth-2'])
    expect(state.activeBoothId).toBe('booth-2')
  })
})

describe('updateBoothDetails', () => {
  it('memperbarui kategori dan harga booth yang dituju saja', () => {
    const first = createBooth({ id: 'booth-1' })
    const second = createBooth({ id: 'booth-2' })

    useBoothStore.getState().addBooth(first)
    useBoothStore.getState().addBooth(second)
    useBoothStore.getState().updateBoothDetails('booth-1', {
      category: 'Apparel',
      price: 275_000,
    })

    const state = useBoothStore.getState()
    expect(state.booths[0]).toMatchObject({ category: 'Apparel', price: 275_000 })
    expect(state.booths[1]).toMatchObject({ category: 'Tech', price: 150_000 })
    expect(state.isDirty).toBe(true)
  })

  it('membulatkan harga dan menahan nilai negatif menjadi nol', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().updateBoothDetails(booth.id, { price: 199_999.6 })
    expect(useBoothStore.getState().booths[0].price).toBe(200_000)

    useBoothStore.getState().updateBoothDetails(booth.id, { price: -50_000 })
    expect(useBoothStore.getState().booths[0].price).toBe(0)
  })

  it('mengabaikan harga yang bukan bilangan finite', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().updateBoothDetails(booth.id, { price: Number.NaN })

    expect(useBoothStore.getState().booths[0].price).toBe(150_000)
  })

  it('tidak mengubah booth lain ketika id tidak ditemukan', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().updateBoothDetails('booth-tidak-ada', { price: 1 })

    expect(useBoothStore.getState().booths[0].price).toBe(150_000)
  })
})

describe('updateBoothStatus', () => {
  it('mengubah status booth yang dituju tanpa menandai metadata berubah', () => {
    const first = createBooth({ id: 'booth-1' })
    const second = createBooth({ id: 'booth-2' })

    useBoothStore.getState().addBooth(first)
    useBoothStore.getState().addBooth(second)
    useBoothStore.getState().markSaved()
    useBoothStore.getState().updateBoothStatus('booth-1', 'Booked')

    const state = useBoothStore.getState()
    expect(state.booths[0].status).toBe('Booked')
    expect(state.booths[1].status).toBe('Available')
    expect(state.isDirty).toBe(false)
  })
})

describe('upsertRealtimeBooth', () => {
  it('menambahkan booth baru tanpa menandai denah berubah', () => {
    const booth = createBooth()

    useBoothStore.getState().markSaved()
    useBoothStore.getState().upsertRealtimeBooth(booth)

    const state = useBoothStore.getState()
    expect(state.booths).toEqual([booth])
    expect(state.isDirty).toBe(false)
    expect(state.deletedBoothIds).toEqual([])
  })

  it('memperbarui booth yang sudah ada tanpa mengubah pilihan aktif', () => {
    const first = createBooth({ id: 'booth-1' })
    const second = createBooth({ id: 'booth-2' })
    const updatedFirst = { ...first, status: 'Booked' as const, price: 500_000 }

    useBoothStore.getState().addBooth(first)
    useBoothStore.getState().addBooth(second)
    useBoothStore.getState().markSaved()

    useBoothStore.getState().upsertRealtimeBooth(updatedFirst)

    const state = useBoothStore.getState()
    expect(state.booths).toHaveLength(2)
    expect(state.booths[0]).toMatchObject({ id: 'booth-1', status: 'Booked', price: 500_000 })
    expect(state.activeBoothId).toBe('booth-2')
    expect(state.isDirty).toBe(false)
  })
})

describe('removeRealtimeBooth', () => {
  it('menghapus booth tanpa menandai denah berubah atau mencatat id terhapus', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().markSaved()
    useBoothStore.getState().removeRealtimeBooth(booth.id)

    const state = useBoothStore.getState()
    expect(state.booths).toEqual([])
    expect(state.activeBoothId).toBeNull()
    expect(state.isDirty).toBe(false)
    expect(state.deletedBoothIds).toEqual([])
  })

  it('mempertahankan pilihan booth lain saat booth yang tidak aktif dihapus', () => {
    const first = createBooth({ id: 'booth-1' })
    const second = createBooth({ id: 'booth-2' })

    useBoothStore.getState().addBooth(first)
    useBoothStore.getState().addBooth(second)
    useBoothStore.getState().markSaved()
    useBoothStore.getState().removeRealtimeBooth(first.id)

    const state = useBoothStore.getState()
    expect(state.booths.map((booth) => booth.id)).toEqual(['booth-2'])
    expect(state.activeBoothId).toBe('booth-2')
    expect(state.isDirty).toBe(false)
  })
})

describe('updateBoothPosition', () => {
  it('memperbarui koordinat booth dan menandai denah berubah', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().updateBoothPosition(booth.id, 240, 360)

    const state = useBoothStore.getState()
    expect(state.booths[0]).toMatchObject({ positionX: 240, positionY: 360 })
    expect(state.isDirty).toBe(true)
  })
})

describe('loadBlueprint dan markSaved', () => {
  it('memuat denah beserta gambar dan mereset status kotor', () => {
    useBoothStore.getState().addBooth(createBooth())

    const draft = { ...blueprintDraft, imageUrl: 'https://example.com/denah.png' }
    useBoothStore.getState().loadBlueprint('hall-b', [], draft)

    const state = useBoothStore.getState()
    expect(state.blueprintId).toBe('hall-b')
    expect(state.blueprintDraft).toEqual(draft)
    expect(state.blueprintImageUrl).toBe('https://example.com/denah.png')
    expect(state.booths).toEqual([])
    expect(state.isDirty).toBe(false)
    expect(state.deletedBoothIds).toEqual([])
  })

  it('menghapus penanda kotor dan daftar booth terhapus setelah disimpan', () => {
    const booth = createBooth()

    useBoothStore.getState().addBooth(booth)
    useBoothStore.getState().removeBooth(booth.id)
    useBoothStore.getState().markSaved()

    const state = useBoothStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.deletedBoothIds).toEqual([])
  })
})

describe('resetBooths', () => {
  it('mengosongkan seluruh state denah', () => {
    useBoothStore.getState().addBooth(createBooth())
    useBoothStore.getState().resetBooths()

    const state = useBoothStore.getState()
    expect(state.booths).toEqual([])
    expect(state.activeBoothId).toBeNull()
    expect(state.blueprintDraft).toBeNull()
    expect(state.blueprintImageUrl).toBeNull()
    expect(state.isDirty).toBe(false)
    expect(state.deletedBoothIds).toEqual([])
  })
})
