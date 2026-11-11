import { Link } from 'react-router-dom'
import { ArrowRight } from '../LandingIcons'
import { events } from '../landingContent'

export default function EventsSection() {
  return (
    <section id="acara" className="scroll-mt-20 border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
                Agenda
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Acara yang masih membuka booth.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Lihat denah, bandingkan posisi, lalu kunci booth sebelum diambil penyewa lain.
            </p>
          </div>
          <Link
            to="/event"
            className="inline-flex items-center gap-2 rounded-control text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            Lihat semua acara
            <ArrowRight />
          </Link>
        </div>

        <div className="mt-9 divide-y divide-line border-y border-line">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/event/${event.id}`}
              className="group grid gap-4 px-1 py-5 transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-4 motion-reduce:transition-none"
            >
              <div className="flex items-baseline gap-2 sm:block">
                <p className="text-xl font-semibold tabular-nums tracking-tight text-ink sm:text-2xl">
                  {event.day}
                </p>
                <p className="text-tiny font-semibold uppercase tracking-[0.16em] text-muted">
                  {event.month}
                </p>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{event.title}</h3>
                  <span className="rounded-chip border border-line bg-surface px-1.5 py-0.5 text-tiny font-medium text-muted">
                    {event.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{event.venue}</p>
              </div>

              <div className="flex items-center justify-between gap-5 sm:justify-end sm:text-right">
                <div>
                  <p className="text-sm font-semibold tabular-nums text-ink">
                    {event.available}{' '}
                    <span className="font-normal text-muted">dari {event.total}</span>
                  </p>
                  <p className="text-tiny font-semibold uppercase tracking-[0.12em] text-muted">
                    booth tersedia
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine transition-colors group-hover:text-pine-dark">
                  Lihat denah
                  <ArrowRight />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
