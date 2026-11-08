import { Link } from 'react-router-dom'
import { ArrowRight } from '../LandingIcons'

export default function CtaSection() {
  return (
    <section className="bg-pine">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-2 w-2 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine-soft">
                Mulai dari denah
              </p>
            </div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Booth yang tepat biasanya diambil lebih dulu.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-pine-soft">
              Bandingkan posisi dan status booth, lalu kunci lokasi sebelum acara dimulai.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link
              to="/event"
              className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-white px-5 py-3 text-sm font-semibold text-pine transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pine motion-reduce:transition-none"
            >
              Cari booth
              <ArrowRight />
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center justify-center rounded-[6px] border border-pine-soft px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pine motion-reduce:transition-none"
            >
              Buka dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
