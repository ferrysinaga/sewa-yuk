interface SummaryCard {
  label: string
  value: string
  sub: string
  title?: string
}

export default function SummaryCards({ summaryCards }: { summaryCards: SummaryCard[] }) {
  return (
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
          <p className="text-tiny font-semibold uppercase tracking-[0.14em] text-muted">
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
  )
}
