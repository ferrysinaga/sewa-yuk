interface SummaryCard {
  label: string
  value: string
  sub: string
  title?: string
}

export default function SummaryCards({ summaryCards }: { summaryCards: SummaryCard[] }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((stat) => (
        <div key={stat.label} className="rounded-card border border-line bg-surface p-5">
          <p className="text-xs font-medium text-muted">{stat.label}</p>
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
  )
}
