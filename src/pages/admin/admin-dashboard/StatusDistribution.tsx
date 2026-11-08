import type { AdminDashboardState } from './useAdminDashboard'

export default function StatusDistribution({ dashboard }: { dashboard: AdminDashboardState }) {
  const { statusDistribution, activeEventLabel, statusMeta } = dashboard

  return (
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
  )
}
