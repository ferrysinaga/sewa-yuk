import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../../components/ui/Toast'
import {
  BOOTH_CATEGORY_LABEL as categoryLabel,
  BOOTH_STATUS_META as statusMeta,
  formatPrice,
} from '../../../lib/boothDisplay'
import { rollbackRowStatus, setRowStatus } from '../../../lib/boothStatus'
import { getErrorMessage } from '../../../lib/errors'
import { createChannelName } from '../../../lib/id'
import type { BoothRow } from '../../../lib/boothRow'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/useAuthStore'
import { useBoothStore } from '../../../store/useBoothStore'
import type { BlueprintStatus } from '../../../types/blueprint'
import type { BoothCategory, BoothStatus } from '../../../types/booth'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'

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

export const statusOptions: BoothStatus[] = ['Available', 'Reserved', 'Booked']
export const categoryOptions: BoothCategory[] = ['Tech', 'F&B', 'Apparel']

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

export function useAdminDashboard() {
  const user = useAuthStore((state) => state.user)
  const { showToast } = useToast()

  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([])
  const [booths, setBooths] = useState<BoothRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])
  const hasSubscribedRef = useRef(false)
  const isOnline = useOnlineStatus()
  const wasOnlineRef = useRef(isOnline)

  const [blueprintFilter, setBlueprintFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<BoothCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<BoothStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || 'Penyelenggara'

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

    hasSubscribedRef.current = false

    const channel = supabase
      .channel(createChannelName('admin-booths'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booths' }, (payload) => {
        setBooths((current) => applyBoothChange(current, payload as BoothChangePayload))
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')

        if (status === 'SUBSCRIBED') {
          // Reconnect: muat ulang data karena event selama offline bisa hilang.
          if (hasSubscribedRef.current) {
            setReloadToken((token) => token + 1)
          }
          hasSubscribedRef.current = true
        }

        if (status === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime dashboard gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      setIsLive(false)
      hasSubscribedRef.current = false
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (isOnline && !wasOnlineRef.current && hasSubscribedRef.current) {
      setReloadToken((token) => token + 1)
    }

    wasOnlineRef.current = isOnline
  }, [isOnline])

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

    // Optimistic: tampilkan status baru segera, lalu rollback bila server
    // menolak. Realtime yang lebih dulu mengubah status tidak ditimpa rollback.
    setBooths((current) => setRowStatus(current, booth.id, nextStatus))
    useBoothStore.getState().updateBoothStatus(booth.id, nextStatus)

    try {
      const { data, error: updateError } = await supabase
        .from('booths')
        .update({ status: nextStatus })
        .eq('id', booth.id)
        .select('*')
        .single()

      if (updateError) throw updateError

      setBooths((current) => current.map((row) => (row.id === booth.id ? (data as BoothRow) : row)))
      useBoothStore.getState().updateBoothStatus(booth.id, nextStatus)

      showToast(
        `Status booth ${booth.id.slice(0, 8)} diubah menjadi ${statusMeta[nextStatus].label}.`,
        'success',
      )
    } catch (updateError) {
      setBooths((current) => rollbackRowStatus(current, booth.id, nextStatus, booth.status))

      const storeBooth = useBoothStore.getState().booths.find((row) => row.id === booth.id)
      if (storeBooth?.status === nextStatus) {
        useBoothStore.getState().updateBoothStatus(booth.id, booth.status)
      }

      const message = getErrorMessage(updateError, 'Terjadi kesalahan.')
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

  const reload = () => setReloadToken((token) => token + 1)

  return {
    blueprints,
    booths,
    loading,
    error,
    reload,
    isLive: isOnline && isLive,
    updatingIds,
    blueprintFilter,
    setBlueprintFilter,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    displayName,
    blueprintNameById,
    scopeBooths,
    filteredBooths,
    metrics,
    eventSummaries,
    activeEvent,
    activeEventLabel,
    handleStatusChange,
    statusDistribution,
    summaryCards,
    categoryLabel,
    statusMeta,
  }
}

export type AdminDashboardState = ReturnType<typeof useAdminDashboard>
