import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
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
import type { BoothStatus } from '../../types/booth'

interface BoothSummaryRow {
  blueprint_id: string
  status: BoothStatus
}

interface BlueprintSummary extends BlueprintRow {
  totalBooths: number
  availableBooths: number
}

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])

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
      const [blueprintResult, boothResult] = await Promise.all([
        supabase
          .from('blueprints')
          .select('id, name, venue, event_date, description, status, image_url, image_path')
          .order('created_at', { ascending: false }),
        supabase.from('booths').select('blueprint_id, status'),
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

      setBlueprints((blueprintResult.data ?? []) as BlueprintRow[])
      setBooths((boothResult.data ?? []) as BoothSummaryRow[])
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

        return {
          ...blueprint,
          totalBooths: eventBooths.length,
          availableBooths: eventBooths.filter((booth) => booth.status === 'Available').length,
        }
      }),
    [blueprints, booths],
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

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
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
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Kelola Denah
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            {showCreate ? 'Tutup Form' : 'Buat Denah Baru'}
          </button>
        </div>

        {showCreate && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Denah baru</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Denah disimpan sebagai draft. ID denah dipakai pada URL halaman tenant.
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
                Draft
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="blueprint-name" className="text-xs font-medium text-gray-700">
                  Nama denah / event
                </label>
                <input
                  id="blueprint-name"
                  type="text"
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="Contoh: Pameran Teknologi Nusantara 2026"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="blueprint-id" className="text-xs font-medium text-gray-700">
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
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Huruf kecil, angka, dan tanda hubung. Contoh URL: /event/
                  {blueprintId || 'id-denah'}
                </p>
              </div>

              <div>
                <label htmlFor="blueprint-venue" className="text-xs font-medium text-gray-700">
                  Venue
                </label>
                <input
                  id="blueprint-venue"
                  type="text"
                  value={venue}
                  onChange={(event) => setVenue(event.target.value)}
                  placeholder="Jakarta Convention Center - Hall A"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="blueprint-date" className="text-xs font-medium text-gray-700">
                  Tanggal event
                </label>
                <input
                  id="blueprint-date"
                  type="text"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  placeholder="12 - 15 Maret 2026"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="blueprint-description" className="text-xs font-medium text-gray-700">
                  Deskripsi
                </label>
                <textarea
                  id="blueprint-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Deskripsi singkat event yang akan tampil di halaman tenant."
                  className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
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
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-gray-900">{summaries.length}</span> denah
            </span>
            <span>
              <span className="font-semibold text-emerald-700">{publishedCount}</span> dipublikasikan
            </span>
            <span>
              <span className="font-semibold text-amber-700">{draftCount}</span> draft
            </span>
          </div>
        )}

        {loading && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Gagal memuat denah</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && summaries.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Belum ada denah</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
              Buat denah pertama, tambahkan booth, lalu publikasikan agar tenant dapat melihatnya.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
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
                  className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[blueprint.status]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isPublished ? 'bg-emerald-500' : blueprint.status === 'draft' ? 'bg-amber-500' : 'bg-gray-400'
                        }`}
                      />
                      {BLUEPRINT_STATUS_LABEL[blueprint.status]}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {blueprint.totalBooths} booth
                    </span>
                  </div>

                  {blueprint.image_url && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                      <img
                        src={blueprint.image_url}
                        alt={`Gambar denah ${blueprint.name}`}
                        loading="lazy"
                        className="aspect-[1000/640] w-full object-cover"
                      />
                    </div>
                  )}

                  <h2 className="mt-3 text-base font-semibold text-gray-900">{blueprint.name}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {blueprint.venue || 'Venue belum diatur'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {blueprint.event_date || 'Tanggal belum diatur'}
                  </p>

                  {blueprint.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
                      {blueprint.description}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-gray-50 p-2.5">
                      <p className="text-[11px] text-gray-500">Tersedia</p>
                      <p className="mt-0.5 font-semibold text-gray-900">
                        {blueprint.availableBooths} / {blueprint.totalBooths}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-2.5">
                      <p className="text-[11px] text-gray-500">ID denah</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-gray-900" title={blueprint.id}>
                        {blueprint.id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    <Link
                      to={`/admin/blueprint/${blueprint.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    >
                      Atur Denah & Booth
                    </Link>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/event/${blueprint.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      >
                        Pratinjau
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handlePublishToggle(blueprint)}
                        disabled={isUpdating}
                        className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          isPublished
                            ? 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {isUpdating ? 'Menyimpan...' : isPublished ? 'Jadikan Draft' : 'Publikasikan'}
                      </button>
                    </div>
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
