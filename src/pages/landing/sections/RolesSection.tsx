import { Link } from 'react-router-dom'
import { ArrowRight, CheckIcon } from '../LandingIcons'
import { organizerPoints, tenantPoints } from '../landingContent'

export default function RolesSection() {
  return (
    <section id="penyelenggara" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-clay" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Dua peran, satu denah
            </p>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Dibuat untuk yang menyusun, dan yang memilih.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Tata letak dan data booth tidak perlu dikelola di dua tempat berbeda.
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <article className="border-t border-line pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine">
                Penyelenggara
              </p>
              <span className="text-[11px] text-muted">Dashboard admin</span>
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              Susun denah, publikasikan sekali.
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Ruang kerja drag-and-drop dengan bantuan grid. Atur kategori, harga, dan ukuran booth,
              lalu tampilkan denah yang sama ke halaman acara.
            </p>
            <ul className="mt-5 space-y-2.5">
              {organizerPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-ink">
                  <CheckIcon />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/admin"
              className="mt-7 inline-flex items-center gap-2 rounded-[6px] text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Buka dashboard
              <ArrowRight />
            </Link>
          </article>

          <article className="border-t border-line pt-6 lg:border-l lg:pl-14">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine">
                Penyewa
              </p>
              <span className="text-[11px] text-muted">Halaman acara</span>
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              Baca denah, kunci posisi.
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Sorot kategori, bandingkan posisi, dan buka detail booth langsung dari peta. Status
              serta harga selalu mengikuti data terbaru.
            </p>
            <ul className="mt-5 space-y-2.5">
              {tenantPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-ink">
                  <CheckIcon />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/event"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Jelajahi acara
              <ArrowRight />
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
