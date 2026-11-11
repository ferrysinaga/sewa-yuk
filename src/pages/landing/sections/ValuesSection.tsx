import { values } from '../landingContent'

export default function ValuesSection() {
  return (
    <section id="kenapa" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-clay" />
            <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
              Kerja di atas denah
            </p>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Bukan daftar harga. Ini denah yang bisa dibaca.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Keputusan sewa booth dibuat dari posisi, bukan dari nama booth semata. Semua informasi
            yang dibutuhkan ada di satu bidang yang sama.
          </p>
        </div>

        <div className="mt-10 grid gap-x-8 gap-y-8 md:grid-cols-3">
          {values.map((value, index) => (
            <div key={value.title} className="border-t border-line pt-5">
              <p className="text-compact font-semibold uppercase tracking-[0.16em] text-clay-dark">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-ink">{value.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
