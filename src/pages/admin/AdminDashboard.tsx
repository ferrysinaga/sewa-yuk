import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { useToast } from '../../components/ui/Toast'
import { createChannelName } from '../../lib/id'
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

interface BoothChangePayload {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: Partial<BoothRow>
  old?: Partial<BoothRow>
}

const statusMeta: Record<
  BoothStatus,
  { label: string; dot: string; badge: string; bar: string }
> = {
  Available: {
    label: 'Tersedia',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    bar: 'bg-emerald-500',
  },
  Reserved: {
    label: 'Reserved',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-100',
    bar: 'bg-amber-500',
  },
  Booked: {
    label: 'Booked',
    dot: 'bg-gray-500',
    badge: 'bg-gray-100 text-gray-700 ring-gray-200',
    bar: 'bg-gray-500',
  },
}

const statusOptions: BoothStatus[] = ['Available', 'Reserved', 'Booked']
const categoryOptions: BoothCategory[] = ['Tech', 'F&B', 'Apparel']

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

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

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-gray-500">Dashboard Penyelenggara</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Selamat datang, {displayName}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Pantau okupansi dan kelola status seluruh booth dari satu tempat.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/event"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Lihat Halaman Publik
            </Link>
            <Link
              to="/admin/blueprint"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Kelola Denah
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-8 flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
              />
              <p className="text-sm text-gray-500">Memuat inventaris booth…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Gagal memuat dashboard</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">{error}</p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Coba lagi
              </button>
              <Link
                to="/admin/blueprint"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Buka Kelola Denah
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Total booth</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                  {metrics.total}
                </p>
                <p className="mt-1 text-xs text-gray-500">Cakupan: {activeEventLabel}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Booked</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                  {metrics.booked}
                </p>
                <p className="mt-1 text-xs text-gray-500">{metrics.occupancy}% okupansi</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Tersedia</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                  {metrics.available}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {metrics.reserved} booth menunggu pembayaran
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Estimasi pendapatan</p>
                <p
                  className="mt-2 text-2xl font-semibold tracking-tight text-gray-900"
                  title={formatPrice(metrics.revenue)}
                >
                  {formatCompactPrice(metrics.revenue)}
                </p>
                <p className="mt-1 text-xs text-gray-500">Dari {metrics.booked} booth terjual</p>
              </div>
            </div>

            <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-base font-semibold text-gray-900">Inventaris booth</h2>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                          isLive
                            ? 'bg-blue-50 text-blue-700 ring-blue-100'
                            : 'bg-gray-100 text-gray-600 ring-gray-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isLive ? 'animate-pulse bg-blue-600' : 'bg-gray-400'
                          }`}
                        />
                        {isLive ? 'Live' : 'Menghubungkan…'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {filteredBooths.length} dari {scopeBooths.length} booth ditampilkan
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReloadToken((token) => token + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path
                        fillRule="evenodd"
                        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Muat ulang
                  </button>
                </div>

                <div className="grid gap-2 border-b border-gray-200 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="all">Semua kategori</option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                  <table className="min-w-[860px] w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
                    <tbody className="divide-y divide-gray-100">
                      {filteredBooths.map((booth) => {
                        const meta = statusMeta[booth.status]
                        const isUpdating = updatingIds.includes(booth.id)

                        return (
                          <tr key={booth.id} className="transition-colors hover:bg-gray-50/70">
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <p className="font-mono text-xs font-semibold text-gray-900" title={booth.id}>
                                {booth.id.slice(0, 8)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-gray-500">
                                {booth.width} × {booth.height} px
                              </p>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="max-w-[220px] truncate text-xs font-medium text-gray-900">
                                {blueprintNameById.get(booth.blueprint_id) ?? booth.blueprint_id}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                                {booth.category}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs font-medium text-gray-900">
                              {formatPrice(booth.price)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${meta.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
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
                                  className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                                    className="rounded-xl px-2 py-1.5 text-[11px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <div className="border-t border-gray-200 px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-gray-900">
                      {booths.length === 0 ? 'Belum ada booth terdaftar' : 'Tidak ada booth yang cocok'}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
                      {booths.length === 0
                        ? 'Tambahkan booth melalui halaman Kelola Denah agar inventaris muncul di sini.'
                        : 'Coba ubah kata kunci atau filter event, kategori, dan status.'}
                    </p>
                    {booths.length === 0 && (
                      <Link
                        to="/admin/blueprint"
                        className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      >
                        Buka Kelola Denah
                      </Link>
                    )}
                  </div>
                )}
              </section>

              <aside className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-900">Distribusi status</h2>
                  <p className="mt-1 text-xs text-gray-500">{activeEventLabel}</p>

                  <dl className="mt-4 space-y-3.5">
                    {statusDistribution.map((item) => (
                      <div key={item.status}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <dt className="flex items-center gap-2 font-medium text-gray-700">
                            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta[item.status].dot}`} />
                            {statusMeta[item.status].label}
                          </dt>
                          <dd className="font-semibold text-gray-900">
                            {item.count}
                            <span className="ml-1 font-normal text-gray-500">({item.percentage}%)</span>
                          </dd>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${statusMeta[item.status].bar}`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-gray-900">Ringkasan event</h2>
                    <span className="text-xs text-gray-500">{blueprints.length}</span>
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
                            className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                              isActive
                                ? 'border-blue-200 bg-blue-50/60'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-xs font-semibold text-gray-900">
                                  {event.name}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[event.status]}`}
                                >
                                  {BLUEPRINT_STATUS_LABEL[event.status]}
                                </span>
                              </span>
                              <span className="shrink-0 text-[11px] font-medium text-gray-500">
                                {event.booked}/{event.total}
                              </span>
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-gray-500">
                              {event.venue ?? 'Venue belum diatur'}
                            </span>
                            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <span
                                className="block h-full rounded-full bg-blue-600"
                                style={{ width: `${event.occupancy}%` }}
                              />
                            </span>
                            <span className="mt-1.5 block text-[11px] text-gray-500">
                              {event.occupancy}% terjual · {event.available} tersedia
                            </span>
                          </button>
                          <Link
                            to={`/admin/blueprint/${event.id}`}
                            className="mt-1.5 inline-flex text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                          >
                            Atur denah & booth
                          </Link>
                        </li>
                      )
                    })}
                  </ul>

                  {eventSummaries.length === 0 && (
                    <p className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-6 text-center text-xs text-gray-500">
                      Belum ada event/blueprint aktif.
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
