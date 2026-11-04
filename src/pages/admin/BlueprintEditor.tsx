import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import BlueprintWorkspace from '../../components/map/BlueprintWorkspace'
import { useToast } from '../../components/ui/Toast'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { DEFAULT_BLUEPRINT_ID, useBoothStore } from '../../store/useBoothStore'
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message)
  }
  return 'Terjadi kesalahan yang tidak diketahui.'
}

function getFriendlyErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)

  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return 'Tabel "booths" belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.'
  }

  if (/row-level security|permission denied|not authorized/i.test(message)) {
    return 'Akun Anda tidak memiliki izin untuk mengubah denah ini. Pastikan akun memiliki role organizer.'
  }

  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'Tidak dapat terhubung ke Supabase. Periksa koneksi internet Anda lalu coba lagi.'
  }

  return message || 'Terjadi kesalahan saat menghubungi Supabase.'
}

export default function BlueprintEditor() {
  const isDirty = useBoothStore((state) => state.isDirty)
  const boothCount = useBoothStore((state) => state.booths.length)
  const setBooths = useBoothStore((state) => state.setBooths)
  const markSaved = useBoothStore((state) => state.markSaved)
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    setLoadError(null)

    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Jangan timpa perubahan yang belum disimpan ketika pengguna membuka kembali editor.
    if (useBoothStore.getState().isDirty) {
      setLoading(false)
      return
    }

    setLoading(true)

    const loadBlueprint = async () => {
      const { data, error } = await supabase
        .from('booths')
        .select('*')
        .eq('blueprint_id', DEFAULT_BLUEPRINT_ID)

      if (cancelled) return

      if (error) {
        const message = getFriendlyErrorMessage(error)
        setLoadError(message)
        // Hindari menampilkan/menyimpan data event lain yang mungkin masih ada di store.
        setBooths([])
        setLoading(false)
        return
      }

      setBooths(Array.isArray(data) ? (data as BoothRow[]).map(mapRowToBooth) : [])
      setLoading(false)
    }

    void loadBlueprint()

    return () => {
      cancelled = true
    }
  }, [reloadToken, setBooths])

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

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.',
        'error',
      )
      return
    }

    if (loadError) {
      showToast('Denah belum berhasil dimuat. Muat ulang data sebelum menyimpan.', 'error')
      return
    }

    const store = useBoothStore.getState()
    const booths = store.booths
    const deletedBoothIds = store.deletedBoothIds

    if (booths.length === 0 && deletedBoothIds.length === 0) {
      showToast('Tambahkan minimal satu booth sebelum menyimpan denah.', 'error')
      return
    }

    const invalidBooth = booths.find(
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
      const payload = booths.map((booth) => ({
        id: booth.id,
        blueprint_id: booth.blueprintId || store.blueprintId,
        category: booth.category,
        position_x: Math.round(booth.positionX),
        position_y: Math.round(booth.positionY),
        width: booth.width,
        height: booth.height,
        price: Math.round(booth.price),
        updated_at: new Date().toISOString(),
        // `status` sengaja tidak dikirim agar penyimpanan denah tidak menimpa
        // status Reserved/Booked yang baru saja diubah oleh penyewa (realtime).
      }))

      if (payload.length > 0) {
        const { error } = await supabase.from('booths').upsert(payload, { onConflict: 'id' })
        if (error) throw error
      }

      if (deletedBoothIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('booths')
          .delete()
          .in('id', deletedBoothIds)

        if (deleteError) throw deleteError
      }

      markSaved()

      showToast(
        payload.length > 0
          ? `Denah berhasil disimpan. ${payload.length} booth tersimpan permanen.`
          : 'Denah berhasil diperbarui. Semua booth telah dihapus dari blueprint ini.',
        'success',
      )
    } catch (error) {
      showToast(`Gagal menyimpan denah: ${getFriendlyErrorMessage(error)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
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

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                Blueprint Editor
              </h1>
              {isDirty && (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Perubahan belum disimpan
                </span>
              )}
              {!loading && !loadError && (
                <span className="text-xs font-medium text-gray-500">{boothCount} booth</span>
              )}
              {loading && <span className="text-xs text-gray-500">Memuat denah…</span>}
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
              Tarik kategori booth ke kanvas, atur posisi dengan snap-to-grid, lalu simpan konfigurasi ke
              Supabase.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || Boolean(loadError)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                Simpan Perubahan Denah
              </>
            )}
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Supabase belum dikonfigurasi. Isi <code className="font-semibold">VITE_SUPABASE_URL</code>{' '}
            dan <code className="font-semibold">VITE_SUPABASE_ANON_KEY</code> pada file{' '}
            <code className="font-semibold">.env</code> agar denah dapat dimuat dan disimpan.
          </div>
        )}

        {loadError && !loading && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="leading-relaxed">Gagal memuat denah: {loadError}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
                />
                <p className="text-sm text-gray-500">Memuat denah dari Supabase…</p>
              </div>
            </div>
          ) : (
            !loadError && <BlueprintWorkspace />
          )}
        </div>
      </main>
    </div>
  )
}
