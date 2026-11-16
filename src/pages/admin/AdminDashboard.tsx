import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import BoothInventoryTable from './admin-dashboard/BoothInventoryTable'
import DashboardHeader from './admin-dashboard/DashboardHeader'
import EventSummaryList from './admin-dashboard/EventSummaryList'
import StatusDistribution from './admin-dashboard/StatusDistribution'
import SummaryCards from './admin-dashboard/SummaryCards'
import { useAdminDashboard } from './admin-dashboard/useAdminDashboard'

export default function AdminDashboard() {
  const dashboard = useAdminDashboard()
  useDocumentTitle('Dashboard Organizer')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-8 focus:outline-none sm:px-6 sm:py-10 lg:px-8"
      >
        <DashboardHeader dashboard={dashboard} />

        {dashboard.loading && (
          <LoadingPanel
            title="Memuat inventaris booth…"
            description="Mengambil data blueprint dan status booth terbaru."
            minHeightClassName="min-h-[320px]"
          />
        )}

        {!dashboard.loading && dashboard.error && (
          <ErrorPanel
            title="Gagal memuat dashboard"
            description={dashboard.error}
            iconTone="clay"
            onRetry={dashboard.reload}
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

        {!dashboard.loading && !dashboard.error && (
          <>
            <SummaryCards summaryCards={dashboard.summaryCards} />

            <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <BoothInventoryTable dashboard={dashboard} />

              <aside className="space-y-5">
                <StatusDistribution dashboard={dashboard} />
                <EventSummaryList dashboard={dashboard} />
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
