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

export default function BlueprintEditor() {
  const booths = useBoothStore((state) => state.booths)
  const blueprintId = useBoothStore((state) => state.blueprintId)
  const isDirty = useBoothStore((state) => state.isDirty)
  const setBooths = useBoothStore((state) => state.setBooths)
  const markSaved = useBoothStore((state) => state.markSaved)
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadBlueprint = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('booths')
        .select('*')
        .eq('blueprint_id', DEFAULT_BLUEPRINT_ID)

      if (cancelled) return

      if (error) {
        console.warn('Gagal memuat blueprint dari Supabase:', error.message)
      } else if (Array.isArray(data)) {
        setBooths((data as BoothRow[]).map(mapRowToBooth))
      }

      setLoading(false)
    }

    void loadBlueprint()

    return () => {
      cancelled = true
    }
  }, [setBooths])

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.',
        'error',
      )
      return
    }

    if (booths.length === 0) {
      showToast('Tambahkan minimal satu booth sebelum menyimpan denah.', 'error')
      return
    }

    setSaving(true)

    try {
      const payload = booths.map((booth) => ({
        id: booth.id,
        blueprint_id: booth.blueprintId || blueprintId,
        category: booth.category,
        position_x: Math.round(booth.positionX),
        position_y: Math.round(booth.positionY),
        width: booth.width,
        height: booth.height,
        price: booth.price,
        status: booth.status,
      }))

      const { error } = await supabase.from('booths').upsert(payload, { onConflict: 'id' })

      if (error) throw error

      const savedIds = payload.map((row) => row.id)
      const { error: cleanupError } = await supabase
        .from('booths')
        .delete()
        .eq('blueprint_id', blueprintId)
        .not('id', 'in', `(${savedIds.join(',')})`)

      if (cleanupError) {
        console.warn('Gagal membersihkan booth yang dihapus:', cleanupError.message)
      }

      markSaved()
      showToast(`Denah berhasil disimpan. ${booths.length} booth tersimpan permanen.`, 'success')
    } catch (error) {
      const message = getErrorMessage(error)
      const friendlyMessage = /could not find the table|relation .* does not exist|schema cache/i.test(message)
        ? 'Tabel "booths" belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.'
        : message

      showToast(`Gagal menyimpan denah: ${friendlyMessage}`, 'error')
    } finally {
      setSaving(false)
    }
  }

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
                Denah Hall A
              </h1>
              {isDirty && (
                <span className="inline-flex items-center gap-2 rounded-[4px] border border-line bg-clay-soft px-2.5 py-1 text-[11px] font-medium text-clay-dark">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
                  Perubahan belum disimpan
                </span>
              )}
              {loading && <span className="text-xs text-muted">Memuat denah…</span>}
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Tarik kategori booth ke kanvas, atur posisi dengan snap-to-grid, lalu simpan
              konfigurasi ke Supabase.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
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
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                  <path d="M3.5 3.75A1.75 1.75 0 0 1 5.25 2h7.69a1.75 1.75 0 0 1 1.237.513l2.31 2.31A1.75 1.75 0 0 1 17 6.06v10.19A1.75 1.75 0 0 1 15.25 18H5.25A1.75 1.75 0 0 1 3.5 16.25V3.75Zm3.25-.25a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75H6.75Zm8.5 6.5H5.25a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10Z" />
                </svg>
                Simpan perubahan denah
              </>
            )}
          </button>
        </div>

        <div className="mt-6">
          <BlueprintWorkspace />
        </div>
      </main>
    </div>
  )
}
