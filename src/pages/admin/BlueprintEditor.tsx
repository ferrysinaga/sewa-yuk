import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BlueprintImageUploader from '../../components/admin/BlueprintImageUploader'
import AppHeader from '../../components/layout/AppHeader'
import BlueprintWorkspace from '../../components/map/BlueprintWorkspace'
import { useToast } from '../../components/ui/Toast'
import { getBlueprintErrorMessage, mapBlueprintRowToDraft } from '../../lib/blueprint'
import { getBlueprintImageErrorMessage, removeBlueprintImage } from '../../lib/storage'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useBoothStore } from '../../store/useBoothStore'
import {
  BLUEPRINT_STATUS_BADGE,
  BLUEPRINT_STATUS_LABEL,
  BLUEPRINT_STATUS_OPTIONS,
} from '../../types/blueprint'
import type { BlueprintDraft, BlueprintRow, BlueprintStatus } from '../../types/blueprint'
import type { Booth, BoothCategory, BoothStatus } from '../../types/booth'

interface BoothRow {
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

function mapRowToBooth(row: BoothRow): Booth {
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

export default function BlueprintEditor() {
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

  const statusLabel = draft ? BLUEPRINT_STATUS_LABEL[draft.status] : null

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-[4px] text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M16 10H5m4-4-4 4 4 4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Kembali ke dashboard
            </Link>

            <div className="mt-3 flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Editor denah
              </p>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
                {draft?.name || 'Blueprint Editor'}
              </h1>
              {draft && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[draft.status]}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      draft.status === 'published'
                        ? 'bg-pine'
                        : draft.status === 'draft'
                          ? 'bg-clay'
                          : 'bg-muted'
                    }`}
                  />
                  {statusLabel}
                </span>
              )}
              {isDirty && (
                <span className="inline-flex items-center gap-2 rounded-[4px] border border-line bg-clay-soft px-2.5 py-1 text-[11px] font-medium text-clay-dark">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
                  Perubahan belum disimpan
                </span>
              )}
              {!loading && !loadError && (
                <span className="text-xs font-medium text-muted">{boothCount} booth</span>
              )}
              {loading && <span className="text-xs text-muted">Memuat denah…</span>}
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Tarik kategori booth ke kanvas, atur posisi dengan snap-to-grid, lalu simpan
              konfigurasi ke Supabase.
            </p>
            <p className="mt-1 text-sm text-muted">
              {[draft?.venue, draft?.eventDate].filter(Boolean).join(' · ') ||
                (loading ? 'Memuat informasi event...' : 'Lengkapi informasi denah di bawah.')}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">/event/{blueprintId}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!loading && !loadError && (
              <Link
                to={`/event/${blueprintId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path
                    fillRule="evenodd"
                    d="M.664 10.59a1.65 1.65 0 0 1 0-1.18 10.05 10.05 0 0 1 18.672 0 1.65 1.65 0 0 1 0 1.18 10.05 10.05 0 0 1-18.672 0ZM14.5 10a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
                    clipRule="evenodd"
                  />
                </svg>
                Pratinjau
              </Link>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || Boolean(loadError) || !draft}
              className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              {saving ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Menyimpan…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M3.5 3.75A1.75 1.75 0 0 1 5.25 2h7.69a1.75 1.75 0 0 1 1.237.513l2.31 2.31A1.75 1.75 0 0 1 17 6.06v10.19A1.75 1.75 0 0 1 15.25 18H5.25A1.75 1.75 0 0 1 3.5 16.25V3.75Zm3.25-.25a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75H6.75Zm8.5 6.5H5.25a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10Z" />
                  </svg>
                  Simpan perubahan denah
                </>
              )}
            </button>
          </div>
        </div>

        {!loading && !loadError && draft && (
          <section className="mt-6 rounded-[10px] border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Informasi denah</h2>
                <p className="mt-1 text-xs text-muted">
                  Metadata ini tampil di halaman event tenant.
                </p>
              </div>
              <select
                value={draft.status}
                onChange={(event) => updateDraft({ status: event.target.value as BlueprintStatus })}
                aria-label="Status publikasi denah"
                className="rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
              >
                {BLUEPRINT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {BLUEPRINT_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="editor-blueprint-name" className="text-xs font-medium text-ink">
                  Nama denah / event
                </label>
                <input
                  id="editor-blueprint-name"
                  type="text"
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div>
                <label htmlFor="editor-blueprint-venue" className="text-xs font-medium text-ink">
                  Venue
                </label>
                <input
                  id="editor-blueprint-venue"
                  type="text"
                  value={draft.venue}
                  onChange={(event) => updateDraft({ venue: event.target.value })}
                  placeholder="Nama venue dan hall"
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div>
                <label htmlFor="editor-blueprint-date" className="text-xs font-medium text-ink">
                  Tanggal event
                </label>
                <input
                  id="editor-blueprint-date"
                  type="text"
                  value={draft.eventDate}
                  onChange={(event) => updateDraft({ eventDate: event.target.value })}
                  placeholder="12 - 15 Maret 2026"
                  className="mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="editor-blueprint-description" className="text-xs font-medium text-ink">
                  Deskripsi
                </label>
                <textarea
                  id="editor-blueprint-description"
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  rows={3}
                  placeholder="Deskripsi singkat event untuk tenant."
                  className="mt-1.5 w-full resize-y rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                />
              </div>

              <div className="border-t border-line pt-4 sm:col-span-2">
                <BlueprintImageUploader
                  blueprintId={blueprintId}
                  imageUrl={draft.imageUrl}
                  imagePath={draft.imagePath}
                  savedImagePath={savedImagePathRef.current}
                  onChange={(image) =>
                    updateDraft({
                      imageUrl: image?.url ?? '',
                      imagePath: image?.path ?? '',
                    })
                  }
                  disabled={saving}
                />
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              {draft.status === 'published'
                ? 'Denah berstatus Dipublikasikan dan dapat dilihat tenant setelah perubahan disimpan.'
                : draft.status === 'archived'
                  ? 'Denah Diarsipkan tidak tampil di halaman event tenant.'
                  : 'Denah masih Draft. Publikasikan agar tenant dapat melihat dan memilih booth.'}
            </p>
          </section>
        )}

        {loading && (
          <div className="mt-6 flex min-h-[360px] items-center justify-center rounded-[10px] border border-line bg-surface">
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine"
              />
              <p className="text-sm text-muted">Memuat denah dari Supabase...</p>
            </div>
          </div>
        )}

        {!loading && loadError && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-[10px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="leading-relaxed">Gagal memuat denah: {loadError}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="inline-flex shrink-0 items-center justify-center rounded-[6px] border border-red-200 bg-surface px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Coba lagi
              </button>
              <Link
                to="/admin/blueprint"
                className="inline-flex shrink-0 items-center justify-center rounded-[6px] border border-red-200 bg-surface px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Daftar denah
              </Link>
            </div>
          </div>
        )}

        {!loading && !loadError && draft && (
          <div className="mt-6">
            <BlueprintWorkspace />
          </div>
        )}
      </main>
    </div>
  )
}
