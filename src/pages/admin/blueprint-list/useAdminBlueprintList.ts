import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../../components/ui/Toast'
import {
  getBlueprintErrorMessage,
  isValidBlueprintId,
  slugifyBlueprintName,
} from '../../../lib/blueprint'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import type { BlueprintRow, BlueprintStatus } from '../../../types/blueprint'
import type { BookingStatus } from '../../../types/booking'
import type { BoothStatus } from '../../../types/booth'

export interface BoothSummaryRow {
  blueprint_id: string
  status: BoothStatus
}

export interface BookingSummaryRow {
  blueprint_id: string
  status: BookingStatus
}

export interface BlueprintSummary extends BlueprintRow {
  totalBooths: number
  availableBooths: number
  totalBookings: number
  activeBookings: number
}

export interface EditDraft {
  name: string
  venue: string
  eventDate: string
}

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'awaiting_confirmation',
  'confirmed',
]

function getCreateFormError(name: string, id: string) {
  if (!name.trim()) return 'Nama denah wajib diisi.'
  if (!id.trim()) return 'ID denah wajib diisi.'
  if (!isValidBlueprintId(id.trim())) {
    return 'ID denah hanya boleh berisi huruf kecil, angka, dan tanda hubung (-).'
  }
  return null
}

export function useAdminBlueprintList() {
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([])
  const [booths, setBooths] = useState<BoothSummaryRow[]>([])
  const [bookings, setBookings] = useState<BookingSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: '',
    venue: '',
    eventDate: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [blueprintId, setBlueprintId] = useState('')
  const [idTouched, setIdTouched] = useState(false)
  const [venue, setVenue] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const loadBlueprints = async () => {
      const [blueprintResult, boothResult, bookingResult] = await Promise.all([
        supabase
          .from('blueprints')
          .select('id, name, venue, event_date, description, status, image_url, image_path')
          .order('created_at', { ascending: false }),
        supabase.from('booths').select('blueprint_id, status'),
        supabase.from('bookings').select('blueprint_id, status'),
      ])

      if (cancelled) return

      if (blueprintResult.error) {
        setError(getBlueprintErrorMessage(blueprintResult.error))
        setLoading(false)
        return
      }

      if (boothResult.error) {
        setError(getBlueprintErrorMessage(boothResult.error))
        setLoading(false)
        return
      }

      if (bookingResult.error) {
        setError(getBlueprintErrorMessage(bookingResult.error))
        setLoading(false)
        return
      }

      setBlueprints((blueprintResult.data ?? []) as BlueprintRow[])
      setBooths((boothResult.data ?? []) as BoothSummaryRow[])
      setBookings((bookingResult.data ?? []) as BookingSummaryRow[])
      setLoading(false)
    }

    void loadBlueprints()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const summaries = useMemo<BlueprintSummary[]>(
    () =>
      blueprints.map((blueprint) => {
        const eventBooths = booths.filter((booth) => booth.blueprint_id === blueprint.id)
        const eventBookings = bookings.filter(
          (booking) => booking.blueprint_id === blueprint.id,
        )

        return {
          ...blueprint,
          totalBooths: eventBooths.length,
          availableBooths: eventBooths.filter((booth) => booth.status === 'Available').length,
          totalBookings: eventBookings.length,
          activeBookings: eventBookings.filter((booking) =>
            ACTIVE_BOOKING_STATUSES.includes(booking.status),
          ).length,
        }
      }),
    [blueprints, bookings, booths],
  )

  const publishedCount = summaries.filter((blueprint) => blueprint.status === 'published').length
  const draftCount = summaries.filter((blueprint) => blueprint.status === 'draft').length

  const resetForm = () => {
    setName('')
    setBlueprintId('')
    setIdTouched(false)
    setVenue('')
    setEventDate('')
    setDescription('')
    setFormError(null)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!idTouched) setBlueprintId(slugifyBlueprintName(value))
  }

  const handleIdChange = (value: string) => {
    setIdTouched(true)
    setBlueprintId(value)
  }

  const toggleCreate = () => {
    setShowCreate((current) => !current)
    setFormError(null)
  }

  const openCreate = () => {
    setShowCreate(true)
    setFormError(null)
  }

  const closeCreate = () => {
    resetForm()
    setShowCreate(false)
  }

  const handleCreate = async () => {
    if (!isSupabaseConfigured) {
      setFormError('Supabase belum dikonfigurasi. Tidak dapat membuat denah.')
      return
    }

    const id = blueprintId.trim() || slugifyBlueprintName(name)
    const validationError = getCreateFormError(name, id)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setCreating(true)
    setFormError(null)

    try {
      const { error: insertError } = await supabase.from('blueprints').insert({
        id,
        name: name.trim(),
        venue: venue.trim() || null,
        event_date: eventDate.trim() || null,
        description: description.trim() || null,
        status: 'draft',
      })

      if (insertError) throw insertError

      showToast(`Denah "${name.trim()}" dibuat sebagai draft. Tambahkan booth lalu publikasikan.`, 'success')
      resetForm()
      setShowCreate(false)
      setReloadToken((token) => token + 1)
      navigate(`/admin/blueprint/${id}`)
    } catch (createError) {
      setFormError(getBlueprintErrorMessage(createError))
    } finally {
      setCreating(false)
    }
  }

  const handlePublishToggle = async (blueprint: BlueprintSummary) => {
    const nextStatus: BlueprintStatus = blueprint.status === 'published' ? 'draft' : 'published'

    if (nextStatus === 'published' && blueprint.totalBooths === 0) {
      showToast('Tambahkan minimal satu booth sebelum mempublikasikan denah.', 'error')
      return
    }

    if (!isSupabaseConfigured) {
      showToast('Supabase belum dikonfigurasi. Tidak dapat mengubah status denah.', 'error')
      return
    }

    setUpdatingIds((current) => [...current, blueprint.id])

    try {
      const { error: updateError } = await supabase
        .from('blueprints')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', blueprint.id)

      if (updateError) throw updateError

      setBlueprints((current) =>
        current.map((row) =>
          row.id === blueprint.id ? { ...row, status: nextStatus } : row,
        ),
      )

      showToast(
        nextStatus === 'published'
          ? `Denah "${blueprint.name}" berhasil dipublikasikan dan kini terlihat oleh tenant.`
          : `Denah "${blueprint.name}" dikembalikan ke draft dan disembunyikan dari tenant.`,
        'success',
      )
    } catch (updateError) {
      showToast(`Gagal mengubah status denah: ${getBlueprintErrorMessage(updateError)}`, 'error')
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== blueprint.id))
    }
  }

  const startEdit = (blueprint: BlueprintSummary) => {
    setEditingId(blueprint.id)
    setEditDraft({
      name: blueprint.name,
      venue: blueprint.venue ?? '',
      eventDate: blueprint.event_date ?? '',
    })
    setEditError(null)
    setConfirmingDeleteId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError(null)
  }

  const handleSaveEdit = async (blueprint: BlueprintSummary) => {
    const nextName = editDraft.name.trim()

    if (!nextName) {
      setEditError('Nama denah wajib diisi.')
      return
    }

    if (!isSupabaseConfigured) {
      setEditError('Supabase belum dikonfigurasi. Tidak dapat menyimpan perubahan.')
      return
    }

    setSavingEditId(blueprint.id)
    setEditError(null)

    try {
      const nextVenue = editDraft.venue.trim() || null
      const nextEventDate = editDraft.eventDate.trim() || null

      const { error: updateError } = await supabase
        .from('blueprints')
        .update({
          name: nextName,
          venue: nextVenue,
          event_date: nextEventDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', blueprint.id)

      if (updateError) throw updateError

      setBlueprints((current) =>
        current.map((row) =>
          row.id === blueprint.id
            ? { ...row, name: nextName, venue: nextVenue, event_date: nextEventDate }
            : row,
        ),
      )
      setEditingId(null)
      showToast(`Detail denah "${nextName}" berhasil diperbarui.`, 'success')
    } catch (saveError) {
      setEditError(getBlueprintErrorMessage(saveError))
    } finally {
      setSavingEditId(null)
    }
  }

  const handleDelete = async (blueprint: BlueprintSummary) => {
    if (deletingId) return

    if (!isSupabaseConfigured) {
      showToast('Supabase belum dikonfigurasi. Tidak dapat menghapus denah.', 'error')
      return
    }

    if (blueprint.activeBookings > 0) {
      setConfirmingDeleteId(null)
      showToast(
        `Denah "${blueprint.name}" masih memiliki ${blueprint.activeBookings} booking aktif. Selesaikan atau batalkan booking tersebut sebelum menghapus denah.`,
        'error',
      )
      return
    }

    setDeletingId(blueprint.id)

    try {
      // Booth dihapus lebih dulu agar tidak menjadi data yatim. Booking yang
      // sudah selesai/dibatalkan tetap tersimpan sebagai riwayat; booth_id
      // pada booking otomatis menjadi null lewat ON DELETE SET NULL.
      const { error: boothDeleteError } = await supabase
        .from('booths')
        .delete()
        .eq('blueprint_id', blueprint.id)

      if (boothDeleteError) throw boothDeleteError

      const { error: blueprintDeleteError } = await supabase
        .from('blueprints')
        .delete()
        .eq('id', blueprint.id)

      if (blueprintDeleteError) throw blueprintDeleteError

      setBlueprints((current) => current.filter((row) => row.id !== blueprint.id))
      setBooths((current) => current.filter((row) => row.blueprint_id !== blueprint.id))
      setConfirmingDeleteId(null)
      if (editingId === blueprint.id) cancelEdit()
      showToast(`Denah "${blueprint.name}" beserta booth di dalamnya berhasil dihapus.`, 'success')
    } catch (deleteError) {
      showToast(`Gagal menghapus denah: ${getBlueprintErrorMessage(deleteError)}`, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleConfirmDelete = (blueprintId: string) => {
    setConfirmingDeleteId((current) => (current === blueprintId ? null : blueprintId))
  }

  const retry = () => setReloadToken((token) => token + 1)

  return {
    summaries,
    publishedCount,
    draftCount,
    loading,
    error,
    retry,
    updatingIds,
    showCreate,
    toggleCreate,
    openCreate,
    closeCreate,
    creating,
    formError,
    name,
    blueprintId,
    venue,
    eventDate,
    description,
    handleNameChange,
    handleIdChange,
    setVenue,
    setEventDate,
    setDescription,
    handleCreate,
    handlePublishToggle,
    editingId,
    editDraft,
    editError,
    savingEditId,
    setEditDraft,
    startEdit,
    cancelEdit,
    handleSaveEdit,
    confirmingDeleteId,
    deletingId,
    toggleConfirmDelete,
    handleDelete,
  }
}
