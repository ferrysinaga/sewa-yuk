import { Link } from 'react-router-dom'
import BoothMap from '../BoothMap'
import { ArrowDown, ArrowRight } from '../LandingIcons'

export default function HeroSection() {
  return (
    <section className="border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-14 lg:px-8 lg:pb-20 lg:pt-20">
        <div className="max-w-xl">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-2 w-2 bg-clay" />
            <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
              Sewa booth pameran
            </p>
          </div>

          <h1 className="mt-5 text-display-sm font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-5xl lg:text-display">
            Pilih posisinya.
            <br />
            Kunci booth-nya.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-body-lg">
            Bandingkan lokasi, ukuran, dan harga booth langsung di atas denah acara. Status
            diperbarui otomatis, jadi satu booth hanya bisa diambil satu penyewa.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/event"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-pine px-5 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Jelajahi acara
              <ArrowRight />
            </Link>
            <a
              href="#cara-kerja"
              className="inline-flex items-center justify-center gap-2 rounded-control px-1 py-2 text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:px-3 motion-reduce:transition-none"
            >
              Lihat cara kerja
              <ArrowDown />
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-5 text-xs font-medium text-muted">
            {['Peta interaktif', 'Status real-time', 'Satu booth, satu penyewa'].map(
              (item, index) => (
                <li key={item} className="flex items-center gap-3">
                  {index > 0 && (
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line" />
                  )}
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="min-w-0">
          <BoothMap />
        </div>
      </div>
    </section>
  )
}
