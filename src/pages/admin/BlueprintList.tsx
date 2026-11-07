import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import InlineConfirm from '../../components/ui/InlineConfirm'
import { useToast } from '../../components/ui/Toast'
import {
  getBlueprintErrorMessage,
  isValidBlueprintId,
  slugifyBlueprintName,
} from '../../lib/blueprint'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  BLUEPRINT_STATUS_BADGE,
  BLUEPRINT_STATUS_LABEL,
} from '../../types/blueprint'
import type { BlueprintRow, BlueprintStatus } from '../../types/blueprint'
import type { BookingStatus } from '../../types/booking'
import type { BoothStatus } from '../../types/booth'

interface BoothSummaryRow {
  blueprint_id: string
  status: BoothStatus
}

interface BookingSummaryRow {
  blueprint_id: string
  status: BookingStatus
}

interface BlueprintSummary extends BlueprintRow {
  totalBooths: number
  availableBooths: number
  totalBookings: number
  activeBookings: number
}

interface EditDraft {
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

export default function BlueprintList() {
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

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
              clipRule="evenodd"
            />
          </svg>
          Kembali ke dashboard
        </Link>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Ruang kerja organizer
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              Kelola Denah
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Buat denah event, susun booth, lalu publikasikan agar tenant dapat melihat dan memilih
              booth dari halaman event.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreate((current) => !current)
              setFormError(null)
            }}
            aria-expanded={showCreate}
            className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            {showCreate ? 'Tutup Form' : 'Buat Denah Baru'}
          </button>
        </div>

        {showCreate && (
          <section className="mt-6 rounded-[10px] border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Denah baru</h2>
                <p className="mt-1 text-xs text-muted">
                  Denah disimpan sebagai draft. ID denah dipakai pada URL halaman tenant.
                </p>
              </div>
              <span className="rounded-full bg-clay-soft px-3 py-1 text-[11px] font-semibold text-clay-dark ring-1 ring-inset ring-line">
                Draft
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="blueprint-name" className="text-xs font-medium text-ink">
                  Nama denah / event
                </label>
                <input
                  id="blueprint-name"
                  type="text"
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="Contoh: Pameran Teknologi Nusantara 2026"
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div>
                <label htmlFor="blueprint-id" className="text-xs font-medium text-ink">
                  ID denah (URL)
                </label>
                <input
                  id="blueprint-id"
                  type="text"
                  value={blueprintId}
                  onChange={(event) => {
                    setIdTouched(true)
                    setBlueprintId(event.target.value)
                  }}
                  placeholder="pameran-teknologi-2026"
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Huruf kecil, angka, dan tanda hubung. Contoh URL: /event/
                  {blueprintId || 'id-denah'}
                </p>
              </div>

              <div>
                <label htmlFor="blueprint-venue" className="text-xs font-medium text-ink">
                  Venue
                </label>
                <input
                  id="blueprint-venue"
                  type="text"
                  value={venue}
                  onChange={(event) => setVenue(event.target.value)}
                  placeholder="Jakarta Convention Center - Hall A"
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div>
                <label htmlFor="blueprint-date" className="text-xs font-medium text-ink">
                  Tanggal event
                </label>
                <input
                  id="blueprint-date"
                  type="text"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  placeholder="12 - 15 Maret 2026"
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="blueprint-description" className="text-xs font-medium text-ink">
                  Deskripsi
                </label>
                <textarea
                  id="blueprint-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Deskripsi singkat event yang akan tampil di halaman tenant."
                  className="mt-1.5 w-full resize-y rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {formError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowCreate(false)
                }}
                className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating && (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                {creating ? 'Membuat...' : 'Buat & Atur Booth'}
              </button>
            </div>
          </section>
        )}

        {!loading && !error && (
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span>
              <span className="font-semibold text-ink">{summaries.length}</span> denah
            </span>
            <span>
              <span className="font-semibold text-pine-dark">{publishedCount}</span> dipublikasikan
            </span>
            <span>
              <span className="font-semibold text-clay-dark">{draftCount}</span> draft
            </span>
          </div>
        )}

        {loading && (
          <div className="mt-6 flex min-h-[280px] items-center justify-center rounded-[10px] border border-line bg-surface px-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine"
              />
              <p className="text-sm font-medium text-ink">Memuat denah…</p>
              <p className="max-w-xs text-xs leading-relaxed text-muted">
                Mengambil daftar denah dan jumlah booth dari Supabase.
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-[10px] border border-line bg-surface p-8 text-center ">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Gagal memuat denah</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-5 inline-flex items-center justify-center rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && summaries.length === 0 && (
          <div className="mt-6 rounded-[10px] border border-dashed border-line bg-surface p-10 text-center ">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-pine-soft text-pine">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Belum ada denah</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Buat denah pertama, tambahkan booth, lalu publikasikan agar tenant dapat melihatnya.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Buat Denah Baru
            </button>
          </div>
        )}

        {!loading && !error && summaries.length > 0 && (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {summaries.map((blueprint) => {
              const isUpdating = updatingIds.includes(blueprint.id)
              const isPublished = blueprint.status === 'published'

              return (
                <article
                  key={blueprint.id}
                  className="flex flex-col rounded-[10px] border border-line bg-surface p-5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[blueprint.status]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isPublished ? 'bg-pine' : blueprint.status === 'draft' ? 'bg-clay' : 'bg-muted'
                        }`}
                      />
                      {BLUEPRINT_STATUS_LABEL[blueprint.status]}
                    </span>
                    <span className="text-[11px] text-muted">
                      {blueprint.totalBooths} booth
                    </span>
                  </div>

                  {blueprint.image_url && (
                    <div className="mt-3 overflow-hidden rounded-[8px] border border-line bg-canvas">
                      <img
                        src={blueprint.image_url}
                        alt={`Gambar denah ${blueprint.name}`}
                        loading="lazy"
                        className="aspect-[1000/640] w-full object-cover"
                      />
                    </div>
                  )}

                  {editingId === blueprint.id ? (
                    <div
                      id={`edit-form-${blueprint.id}`}
                      className="mt-3 rounded-[8px] border border-line bg-canvas p-3"
                    >
                      <p className="text-xs font-semibold text-ink">Edit detail denah</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        ID denah tetap <span className="font-mono">{blueprint.id}</span> agar tautan
                        event tidak berubah.
                      </p>

                      <div className="mt-3 space-y-2.5">
                        <div>
                          <label
                            htmlFor={`edit-name-${blueprint.id}`}
                            className="text-[11px] font-medium text-ink"
                          >
                            Nama denah
                          </label>
                          <input
                            id={`edit-name-${blueprint.id}`}
                            type="text"
                            value={editDraft.name}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-venue-${blueprint.id}`}
                            className="text-[11px] font-medium text-ink"
                          >
                            Venue
                          </label>
                          <input
                            id={`edit-venue-${blueprint.id}`}
                            type="text"
                            value={editDraft.venue}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                venue: event.target.value,
                              }))
                            }
                            placeholder="Nama venue"
                            className="mt-1 w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-date-${blueprint.id}`}
                            className="text-[11px] font-medium text-ink"
                          >
                            Tanggal event
                          </label>
                          <input
                            id={`edit-date-${blueprint.id}`}
                            type="text"
                            value={editDraft.eventDate}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                eventDate: event.target.value,
                              }))
                            }
                            placeholder="12 - 15 Maret 2026"
                            className="mt-1 w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                          />
                        </div>
                      </div>

                      {editError && (
                        <p
                          role="alert"
                          className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] leading-relaxed text-red-700"
                        >
                          {editError}
                        </p>
                      )}

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(blueprint)}
                          disabled={savingEditId === blueprint.id}
                          className="inline-flex flex-1 items-center justify-center rounded-[6px] bg-pine px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingEditId === blueprint.id ? 'Menyimpan...' : 'Simpan Detail'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex flex-1 items-center justify-center rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="mt-3 text-base font-semibold text-ink">{blueprint.name}</h2>
                      <p className="mt-1 text-xs text-muted">
                        {blueprint.venue || 'Venue belum diatur'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {blueprint.event_date || 'Tanggal belum diatur'}
                      </p>

                      {blueprint.description && (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                          {blueprint.description}
                        </p>
                      )}
                    </>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-[8px] bg-canvas p-2.5">
                      <p className="text-[11px] text-muted">Tersedia</p>
                      <p className="mt-0.5 font-semibold text-ink">
                        {blueprint.availableBooths} / {blueprint.totalBooths}
                      </p>
                    </div>
                    <div className="rounded-[8px] bg-canvas p-2.5">
                      <p className="text-[11px] text-muted">ID denah</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-ink" title={blueprint.id}>
                        {blueprint.id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    <Link
                      to={`/admin/blueprint/${blueprint.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
                    >
                      Atur Denah & Booth
                    </Link>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/event/${blueprint.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
                      >
                        Pratinjau
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handlePublishToggle(blueprint)}
                        disabled={isUpdating}
                        className={`inline-flex items-center justify-center rounded-[8px] px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          isPublished
                            ? 'border border-line bg-surface text-ink hover:bg-canvas'
                            : 'bg-pine text-white hover:bg-pine-dark'
                        }`}
                      >
                        {isUpdating ? 'Menyimpan...' : isPublished ? 'Jadikan Draft' : 'Publikasikan'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editingId === blueprint.id ? cancelEdit() : startEdit(blueprint)
                        }
                        aria-expanded={editingId === blueprint.id}
                        aria-controls={
                          editingId === blueprint.id ? `edit-form-${blueprint.id}` : undefined
                        }
                        className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
                      >
                        {editingId === blueprint.id ? 'Tutup Edit' : 'Edit Detail'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingId === blueprint.id) cancelEdit()
                          setConfirmingDeleteId((current) =>
                            current === blueprint.id ? null : blueprint.id,
                          )
                        }}
                        aria-expanded={confirmingDeleteId === blueprint.id}
                        aria-controls={
                          confirmingDeleteId === blueprint.id
                            ? `delete-blueprint-${blueprint.id}`
                            : undefined
                        }
                        disabled={deletingId === blueprint.id}
                        className="inline-flex items-center justify-center rounded-[8px] border border-red-200 bg-surface px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === blueprint.id ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>

                    {confirmingDeleteId === blueprint.id && (
                      <InlineConfirm
                        id={`delete-blueprint-${blueprint.id}`}
                        title={`Hapus denah "${blueprint.name}"?`}
                        description={
                          blueprint.activeBookings > 0
                            ? `Denah ini masih memiliki ${blueprint.activeBookings} booking aktif dari total ${blueprint.totalBookings} booking. Selesaikan atau batalkan booking tersebut sebelum menghapus.`
                            : blueprint.totalBooths > 0
                              ? `Denah dan ${blueprint.totalBooths} booth di dalamnya akan dihapus permanen. ${blueprint.totalBookings} booking terkait tetap tersimpan sebagai riwayat.`
                              : `Denah akan dihapus permanen. ${blueprint.totalBookings} booking terkait tetap tersimpan sebagai riwayat.`
                        }
                        confirmLabel={deletingId === blueprint.id ? 'Menghapus...' : 'Hapus denah'}
                        onConfirm={() => void handleDelete(blueprint)}
                        onCancel={() => setConfirmingDeleteId(null)}
                      />
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
