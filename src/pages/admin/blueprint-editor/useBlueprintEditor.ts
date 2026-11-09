import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useToast } from '../../../components/ui/Toast'
import { getBlueprintErrorMessage, mapBlueprintRowToDraft } from '../../../lib/blueprint'
import { mapRowToBooth } from '../../../lib/boothRow'
import type { BoothRow } from '../../../lib/boothRow'
import { getBlueprintImageErrorMessage, removeBlueprintImage } from '../../../lib/storage'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import { useBoothStore } from '../../../store/useBoothStore'
import type { BlueprintDraft, BlueprintRow } from '../../../types/blueprint'
import type { BoothStatus } from '../../../types/booth'

export function useBlueprintEditor() {
  const { blueprintId = '' } = useParams<{ blueprintId: string }>()
  const draft = useBoothStore((state) => state.blueprintDraft)
  const isDirty = useBoothStore((state) => state.isDirty)
  const boothCount = useBoothStore((state) => state.booths.length)
  const loadBlueprint = useBoothStore((state) => state.loadBlueprint)
  const setBlueprintDraft = useBoothStore((state) => state.setBlueprintDraft)
  const markSaved = useBoothStore((state) => state.markSaved)
  const resetBooths = useBoothStore((state) => state.resetBooths)
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const savedImagePathRef = useRef('')

  useEffect(() => {
    let cancelled = false

    if (!blueprintId) {
      resetBooths()
      savedImagePathRef.current = ''
      setLoadError('ID denah tidak valid.')
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured) {
      resetBooths()
      savedImagePathRef.current = ''
      setLoadError(
        'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.',
      )
      setLoading(false)
      return
    }

    const state = useBoothStore.getState()

    // Pertahankan perubahan yang belum disimpan hanya untuk denah yang sama.
    if (state.isDirty && state.blueprintId === blueprintId && state.blueprintDraft) {
      setLoadError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    savedImagePathRef.current = ''

    const loadBlueprintData = async () => {
      const [blueprintResult, boothsResult] = await Promise.all([
        supabase.from('blueprints').select('*').eq('id', blueprintId).maybeSingle(),
        supabase.from('booths').select('*').eq('blueprint_id', blueprintId),
      ])

      if (cancelled) return

      if (blueprintResult.error) {
        resetBooths()
        setLoadError(getBlueprintErrorMessage(blueprintResult.error))
        setLoading(false)
        return
      }

      if (!blueprintResult.data) {
        resetBooths()
        setLoadError('Denah tidak ditemukan atau belum dipublikasikan.')
        setLoading(false)
        return
      }

      if (boothsResult.error) {
        resetBooths()
        setLoadError(getBlueprintErrorMessage(boothsResult.error))
        setLoading(false)
        return
      }

      const blueprintRow = blueprintResult.data as BlueprintRow
      const boothRows = (boothsResult.data ?? []) as BoothRow[]

      loadBlueprint(
        blueprintRow.id,
        boothRows.map(mapRowToBooth),
        mapBlueprintRowToDraft(blueprintRow),
      )
      savedImagePathRef.current = blueprintRow.image_path ?? ''
      setLoading(false)
    }

    void loadBlueprintData()

    return () => {
      cancelled = true
    }
  }, [blueprintId, loadBlueprint, reloadToken, resetBooths])

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const updateDraft = (patch: Partial<BlueprintDraft>) => {
    const current = useBoothStore.getState().blueprintDraft
    if (!current) return
    setBlueprintDraft({ ...current, ...patch })
  }

  const handleSave = async () => {
    const store = useBoothStore.getState()
    const currentDraft = store.blueprintDraft

    if (!blueprintId) {
      showToast('ID denah tidak valid. Kembali ke daftar denah.', 'error')
      return
    }

    if (!currentDraft) {
      showToast('Data denah belum siap disimpan.', 'error')
      return
    }

    if (!isSupabaseConfigured) {
      showToast(
        'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.',
        'error',
      )
      return
    }

    if (!currentDraft.name.trim()) {
      showToast('Nama denah wajib diisi sebelum menyimpan.', 'error')
      return
    }

    if (loadError) {
      showToast('Denah belum berhasil dimuat. Muat ulang data sebelum menyimpan.', 'error')
      return
    }

    if (currentDraft.status === 'published' && store.booths.length === 0) {
      showToast('Tambahkan minimal satu booth sebelum mempublikasikan denah.', 'error')
      return
    }

    const invalidBooth = store.booths.find(
      (booth) =>
        !Number.isFinite(booth.price) ||
        booth.price < 0 ||
        !Number.isFinite(booth.positionX) ||
        !Number.isFinite(booth.positionY) ||
        booth.width <= 0 ||
        booth.height <= 0,
    )

    if (invalidBooth) {
      showToast(
        `Data booth ${invalidBooth.id.slice(0, 8)} tidak valid. Periksa harga dan ukurannya.`,
        'error',
      )
      return
    }

    setSaving(true)

    try {
      const now = new Date().toISOString()

      const payload = store.booths.map((booth) => ({
        id: booth.id,
        blueprint_id: blueprintId,
        category: booth.category,
        position_x: Math.round(booth.positionX),
        position_y: Math.round(booth.positionY),
        width: booth.width,
        height: booth.height,
        price: Math.round(booth.price),
        updated_at: now,
        // `status` sengaja tidak dikirim agar penyimpanan denah tidak menimpa
        // status Reserved/Booked yang baru saja diubah oleh penyewa (realtime).
      }))

      if (payload.length > 0) {
        const { error: boothError } = await supabase
          .from('booths')
          .upsert(payload, { onConflict: 'id' })

        if (boothError) throw boothError
      }

      // Status booth disimpan terpisah dan hanya untuk booth yang statusnya
      // benar-benar diubah organizer. Dengan begitu, status Reserved/Booked
      // dari penyewa tidak ikut tertimpa saat denah disimpan.
      const statusUpdates = new Map<BoothStatus, string[]>()

      for (const booth of store.booths) {
        if (store.boothStatusBaseline[booth.id] === booth.status) continue

        const ids = statusUpdates.get(booth.status) ?? []
        ids.push(booth.id)
        statusUpdates.set(booth.status, ids)
      }

      for (const [status, ids] of statusUpdates) {
        const { error: statusError } = await supabase
          .from('booths')
          .update({ status, updated_at: now })
          .in('id', ids)

        if (statusError) throw statusError
      }

      if (store.deletedBoothIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('booths')
          .delete()
          .in('id', store.deletedBoothIds)

        if (deleteError) throw deleteError
      }

      // Metadata dan status publikasi disimpan terakhir agar denah tidak
      // tampil ke tenant sebelum seluruh perubahan booth berhasil tersimpan.
      const { error: blueprintError } = await supabase.from('blueprints').upsert(
        {
          id: blueprintId,
          name: currentDraft.name.trim(),
          venue: currentDraft.venue.trim() || null,
          event_date: currentDraft.eventDate.trim() || null,
          description: currentDraft.description.trim() || null,
          status: currentDraft.status,
          image_url: currentDraft.imageUrl.trim() || null,
          image_path: currentDraft.imagePath.trim() || null,
          updated_at: now,
        },
        { onConflict: 'id' },
      )

      if (blueprintError) throw blueprintError

      const previousImagePath = savedImagePathRef.current
      const nextImagePath = currentDraft.imagePath.trim()

      // Hapus file lama hanya setelah metadata baru tersimpan, agar gambar
      // yang masih dipakai tidak hilang ketika penyimpanan gagal.
      if (previousImagePath && previousImagePath !== nextImagePath) {
        try {
          await removeBlueprintImage(previousImagePath)
        } catch (cleanupError) {
          console.warn('Gagal menghapus gambar lama:', getBlueprintImageErrorMessage(cleanupError))
        }
      }

      savedImagePathRef.current = nextImagePath

      markSaved()

      showToast(
        currentDraft.status === 'published'
          ? `Denah "${currentDraft.name.trim()}" tersimpan dan sudah dipublikasikan ke tenant.`
          : `Denah "${currentDraft.name.trim()}" tersimpan sebagai draft.`,
        'success',
      )
    } catch (saveError) {
      showToast(`Gagal menyimpan denah: ${getBlueprintErrorMessage(saveError)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const retry = () => setReloadToken((token) => token + 1)

  return {
    blueprintId,
    draft,
    isDirty,
    boothCount,
    loading,
    loadError,
    saving,
    savedImagePath: savedImagePathRef.current,
    updateDraft,
    handleSave,
    retry,
  }
}

export type BlueprintEditorState = ReturnType<typeof useBlueprintEditor>
