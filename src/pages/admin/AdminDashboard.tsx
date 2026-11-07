import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useToast } from '../../components/ui/Toast'
import {
  BOOTH_CATEGORY_LABEL as categoryLabel,
  BOOTH_STATUS_META as statusMeta,
  formatPrice,
} from '../../lib/boothDisplay'
import { createChannelName } from '../../lib/id'
import type { BoothRow } from '../../lib/boothRow'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useBoothStore } from '../../store/useBoothStore'
import {
  BLUEPRINT_STATUS_BADGE,
  BLUEPRINT_STATUS_LABEL,
} from '../../types/blueprint'
import type { BlueprintStatus } from '../../types/blueprint'
import type { BoothCategory, BoothStatus } from '../../types/booth'

interface BlueprintRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
  status: BlueprintStatus
}

interface BoothChangePayload {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: Partial<BoothRow>
  old?: Partial<BoothRow>
}

const statusOptions: BoothStatus[] = ['Available', 'Reserved', 'Booked']
const categoryOptions: BoothCategory[] = ['Tech', 'F&B', 'Apparel']

const formatCompactPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(price)

function applyBoothChange(current: BoothRow[], payload: BoothChangePayload): BoothRow[] {
  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old?.id
    return deletedId ? current.filter((booth) => booth.id !== deletedId) : current
  }

  const row = payload.new
  if (!row?.id) return current

  const updated = row as BoothRow
  return current.some((booth) => booth.id === updated.id)
    ? current.map((booth) => (booth.id === updated.id ? updated : booth))
    : [updated, ...current]
}

function getLoadErrorMessage(error: { message?: string } | null): string {
  const message = error?.message ?? ''

  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return 'Tabel blueprints/booths belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.'
  }

  return message || 'Gagal memuat inventaris booth.'
}

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user)
  const { showToast } = useToast()

  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([])
  const [booths, setBooths] = useState<BoothRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])

  const [blueprintFilter, setBlueprintFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<BoothCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<BoothStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || 'Penyelenggara'

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const loadDashboard = async () => {
      const [blueprintResult, boothResult] = await Promise.all([
        supabase.from('blueprints').select('id, name, venue, event_date, status'),
        supabase.from('booths').select('*').order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      if (blueprintResult.error) {
        setError(getLoadErrorMessage(blueprintResult.error))
        setLoading(false)
        return
      }

      if (boothResult.error) {
        setError(getLoadErrorMessage(boothResult.error))
        setLoading(false)
        return
      }

      setBlueprints((blueprintResult.data ?? []) as BlueprintRow[])
      setBooths((boothResult.data ?? []) as BoothRow[])
      setLoading(false)
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel(createChannelName('admin-booths'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booths' },
        (payload) => {
          setBooths((current) => applyBoothChange(current, payload as BoothChangePayload))
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
        if (status === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime dashboard gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      setIsLive(false)
      void supabase.removeChannel(channel)
    }
  }, [])

  const blueprintNameById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint.name])),
    [blueprints],
  )

  const scopeBooths = useMemo(
    () =>
      blueprintFilter === 'all'
        ? booths
        : booths.filter((booth) => booth.blueprint_id === blueprintFilter),
    [blueprintFilter, booths],
  )

  const filteredBooths = useMemo(() => {
    const term = search.trim().toLowerCase()

    return scopeBooths.filter((booth) => {
      if (categoryFilter !== 'all' && booth.category !== categoryFilter) return false
      if (statusFilter !== 'all' && booth.status !== statusFilter) return false

      if (term) {
        const blueprintName = blueprintNameById.get(booth.blueprint_id) ?? booth.blueprint_id
        const haystack =
          `${booth.id} ${booth.category} ${booth.status} ${blueprintName} ${booth.price}`.toLowerCase()

        if (!haystack.includes(term)) return false
      }

      return true
    })
  }, [blueprintNameById, categoryFilter, scopeBooths, search, statusFilter])

  const metrics = useMemo(() => {
    const total = scopeBooths.length
    const booked = scopeBooths.filter((booth) => booth.status === 'Booked').length
    const reserved = scopeBooths.filter((booth) => booth.status === 'Reserved').length
    const available = scopeBooths.filter((booth) => booth.status === 'Available').length
    const revenue = scopeBooths
      .filter((booth) => booth.status === 'Booked')
      .reduce((sum, booth) => sum + booth.price, 0)

    return {
      total,
      booked,
      reserved,
      available,
      revenue,
      occupancy: total > 0 ? Math.round((booked / total) * 100) : 0,
    }
  }, [scopeBooths])

  const eventSummaries = useMemo(
    () =>
      blueprints.map((blueprint) => {
        const eventBooths = booths.filter((booth) => booth.blueprint_id === blueprint.id)
        const total = eventBooths.length
        const booked = eventBooths.filter((booth) => booth.status === 'Booked').length
        const available = eventBooths.filter((booth) => booth.status === 'Available').length

        return {
          ...blueprint,
          total,
          booked,
          available,
          occupancy: total > 0 ? Math.round((booked / total) * 100) : 0,
        }
      }),
    [blueprints, booths],
  )

  const activeEvent =
    blueprintFilter === 'all'
      ? null
      : (blueprints.find((blueprint) => blueprint.id === blueprintFilter) ?? null)

  const activeEventLabel =
    blueprintFilter === 'all'
      ? `${blueprints.length} event`
      : (blueprintNameById.get(blueprintFilter) ?? 'Event terpilih')

  const handleStatusChange = async (booth: BoothRow, nextStatus: BoothStatus) => {
    if (nextStatus === booth.status || updatingIds.includes(booth.id)) return

    if (!isSupabaseConfigured) {
      showToast('Supabase belum dikonfigurasi. Tidak dapat mengubah status booth.', 'error')
      return
    }

    setUpdatingIds((current) => [...current, booth.id])

    try {
      const { data, error: updateError } = await supabase
        .from('booths')
        .update({ status: nextStatus })
        .eq('id', booth.id)
        .select('*')
        .single()

      if (updateError) throw updateError

      setBooths((current) =>
        current.map((row) => (row.id === booth.id ? (data as BoothRow) : row)),
      )
      useBoothStore.getState().updateBoothStatus(booth.id, nextStatus)

      showToast(
        `Status booth ${booth.id.slice(0, 8)} diubah menjadi ${statusMeta[nextStatus].label}.`,
        'success',
      )
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : String(updateError)
      showToast(`Gagal mengubah status booth: ${message}`, 'error')
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== booth.id))
    }
  }

  const statusDistribution = statusOptions.map((status) => {
    const count = scopeBooths.filter((booth) => booth.status === status).length
    const percentage = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0

    return { status, count, percentage }
  })

  const summaryCards = [
    {
      label: 'Total booth',
      value: String(metrics.total),
      sub: `Cakupan: ${activeEventLabel}`,
      title: undefined,
    },
    {
      label: 'Terisi',
      value: String(metrics.booked),
      sub: `${metrics.occupancy}% okupansi`,
      title: undefined,
    },
    {
      label: 'Tersedia',
      value: String(metrics.available),
      sub: `${metrics.reserved} booth menunggu pembayaran`,
      title: undefined,
    },
    {
      label: 'Estimasi pendapatan',
      value: formatCompactPrice(metrics.revenue),
      sub: `Dari ${metrics.booked} booth terjual`,
      title: formatPrice(metrics.revenue),
    },
  ]

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border-b border-line pb-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Dashboard penyelenggara
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              {activeEvent?.name ?? 'Inventaris semua event'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {activeEvent
                ? [activeEvent.venue, activeEvent.event_date].filter(Boolean).join(' · ') ||
                  'Venue dan tanggal belum diatur.'
                : `Selamat datang, ${displayName}. Pantau okupansi dan kelola status booth dari satu tempat.`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/event"
              className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Lihat halaman publik
            </Link>
            <Link
              to="/admin/bookings"
              className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Pemesanan
            </Link>
            <Link
              to="/admin/blueprint"
              className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Kelola Denah
            </Link>
          </div>
        </div>

        {loading && (
          <LoadingPanel
            title="Memuat inventaris booth…"
            description="Mengambil data blueprint dan status booth terbaru."
            minHeightClassName="min-h-[320px]"
          />
        )}

        {!loading && error && (
          <ErrorPanel
            title="Gagal memuat dashboard"
            description={error}
            iconTone="clay"
            onRetry={() => setReloadToken((token) => token + 1)}
            secondaryAction={
              <Link
                to="/admin/blueprint"
                className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Buka Kelola Denah
              </Link>
            }
          />
        )}

        {!loading && !error && (
          <>
            <div className="mt-6 grid border-y border-line sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`px-1 py-5 sm:px-5 ${
                    index === 1 ? 'border-t border-line sm:border-l sm:border-t-0' : ''
                  } ${index === 2 ? 'border-t border-line xl:border-l xl:border-t-0' : ''} ${
                    index === 3 ? 'border-t border-line sm:border-l xl:border-t-0' : ''
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {stat.label}
                  </p>
                  <p
                    className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink"
                    title={stat.title}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-base font-semibold text-ink">Inventaris booth</h2>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-[11px] font-medium ${
                          isLive
                            ? 'border-line bg-pine-soft text-pine'
                            : 'border-line bg-unavailable text-muted'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-pine' : 'bg-muted'}`}
                        />
                        {isLive ? 'Live' : 'Menghubungkan…'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      {filteredBooths.length} dari {scopeBooths.length} booth ditampilkan
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReloadToken((token) => token + 1)}
                    className="inline-flex items-center gap-1.5 rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
                      <path
                        fillRule="evenodd"
                        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Muat ulang
                  </button>
                </div>

                <div className="grid gap-2 border-b border-line px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="admin-search" className="sr-only">
                      Cari booth
                    </label>
                    <input
                      id="admin-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari ID, kategori, event…"
                      className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-event-filter" className="sr-only">
                      Filter event
                    </label>
                    <select
                      id="admin-event-filter"
                      value={blueprintFilter}
                      onChange={(event) => setBlueprintFilter(event.target.value)}
                      className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
                    >
                      <option value="all">Semua event</option>
                      {blueprints.map((blueprint) => (
                        <option key={blueprint.id} value={blueprint.id}>
                          {blueprint.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-category-filter" className="sr-only">
                      Filter kategori
                    </label>
                    <select
                      id="admin-category-filter"
                      value={categoryFilter}
                      onChange={(event) =>
                        setCategoryFilter(event.target.value as BoothCategory | 'all')
                      }
                      className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
                    >
                      <option value="all">Semua kategori</option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel[category]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-status-filter" className="sr-only">
                      Filter status
                    </label>
                    <select
                      id="admin-status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as BoothStatus | 'all')}
                      className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
                    >
                      <option value="all">Semua status</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusMeta[status].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full divide-y divide-line text-left text-sm">
                    <thead className="bg-canvas text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      <tr>
                        <th scope="col" className="px-5 py-3">
                          Booth
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Event
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Kategori
                        </th>
                        <th scope="col" className="px-5 py-3 text-right">
                          Harga
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Status
                        </th>
                        <th scope="col" className="px-5 py-3 text-right">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredBooths.map((booth) => {
                        const meta = statusMeta[booth.status]
                        const isUpdating = updatingIds.includes(booth.id)

                        return (
                          <tr key={booth.id} className="transition-colors hover:bg-canvas motion-reduce:transition-none">
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <p className="font-mono text-xs font-semibold text-ink" title={booth.id}>
                                {booth.id.slice(0, 8)}
                              </p>
                              <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                                {booth.width} × {booth.height} px
                              </p>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="max-w-[220px] truncate text-xs font-medium text-ink">
                                {blueprintNameById.get(booth.blueprint_id) ?? booth.blueprint_id}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <span className="inline-flex rounded-[4px] border border-line bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
                                {categoryLabel[booth.category]}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs font-medium tabular-nums text-ink">
                              {formatPrice(booth.price)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}
                              >
                                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <div className="flex items-center justify-end gap-2">
                                <label className="sr-only" htmlFor={`status-${booth.id}`}>
                                  Ubah status booth {booth.id.slice(0, 8)}
                                </label>
                                <select
                                  id={`status-${booth.id}`}
                                  value={booth.status}
                                  onChange={(event) =>
                                    void handleStatusChange(booth, event.target.value as BoothStatus)
                                  }
                                  disabled={isUpdating}
                                  className="rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                                >
                                  {statusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {statusMeta[status].label}
                                    </option>
                                  ))}
                                </select>
                                {booth.status !== 'Available' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleStatusChange(booth, 'Available')}
                                    disabled={isUpdating}
                                    className="rounded-[4px] px-2 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:bg-pine-soft hover:text-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                                  >
                                    Batalkan
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredBooths.length === 0 && (
                  <div className="border-t border-line px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-ink">
                      {booths.length === 0 ? 'Belum ada booth terdaftar' : 'Tidak ada booth yang cocok'}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
                      {booths.length === 0
                        ? 'Tambahkan booth melalui halaman Kelola Denah agar inventaris muncul di sini.'
                        : 'Coba ubah kata kunci atau filter event, kategori, dan status.'}
                    </p>
                    {booths.length === 0 && (
                      <Link
                        to="/admin/blueprint"
                        className="mt-4 inline-flex items-center justify-center rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                      >
                        Buka Kelola Denah
                      </Link>
                    )}
                  </div>
                )}
              </section>

              <aside className="space-y-5">
                <section className="rounded-[10px] border border-line bg-surface p-5">
                  <h2 className="text-base font-semibold text-ink">Distribusi status</h2>
                  <p className="mt-1 text-xs text-muted">{activeEventLabel}</p>

                  <dl className="mt-4 space-y-3.5">
                    {statusDistribution.map((item) => (
                      <div key={item.status}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <dt className="flex items-center gap-2 font-medium text-ink">
                            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusMeta[item.status].dot}`} />
                            {statusMeta[item.status].label}
                          </dt>
                          <dd className="font-semibold tabular-nums text-ink">
                            {item.count}
                            <span className="ml-1 font-normal text-muted">({item.percentage}%)</span>
                          </dd>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[2px] bg-unavailable">
                          <div
                            className={`h-full rounded-[2px] ${statusMeta[item.status].bar}`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="rounded-[10px] border border-line bg-surface p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-ink">Ringkasan event</h2>
                    <span className="text-xs tabular-nums text-muted">{blueprints.length}</span>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {eventSummaries.map((event) => {
                      const isActive = blueprintFilter === event.id

                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => setBlueprintFilter(isActive ? 'all' : event.id)}
                            aria-pressed={isActive}
                            className={`w-full rounded-[6px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                              isActive
                                ? 'border-pine bg-pine-soft'
                                : 'border-line bg-surface hover:border-pine'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-xs font-semibold text-ink">
                                  {event.name}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[event.status]}`}
                                >
                                  {BLUEPRINT_STATUS_LABEL[event.status]}
                                </span>
                              </span>
                              <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted">
                                {event.booked}/{event.total}
                              </span>
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-muted">
                              {event.venue ?? 'Venue belum diatur'}
                            </span>
                            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-[2px] bg-unavailable">
                              <span
                                className="block h-full rounded-[2px] bg-pine"
                                style={{ width: `${event.occupancy}%` }}
                              />
                            </span>
                            <span className="mt-1.5 block text-[11px] tabular-nums text-muted">
                              {event.occupancy}% terjual · {event.available} tersedia
                            </span>
                          </button>
                          <Link
                            to={`/admin/blueprint/${event.id}`}
                            className="mt-1.5 inline-flex rounded-[4px] text-[11px] font-semibold text-pine-dark transition-colors hover:text-pine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                          >
                            Atur denah & booth
                          </Link>
                        </li>
                      )
                    })}
                  </ul>

                  {eventSummaries.length === 0 && (
                    <p className="mt-4 rounded-[6px] border border-dashed border-line bg-canvas px-4 py-6 text-center text-xs leading-relaxed text-muted">
                      Belum ada event atau blueprint aktif.
                    </p>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
