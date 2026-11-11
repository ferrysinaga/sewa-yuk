import { steps } from '../landingContent'

export default function StepsSection() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
                Alur kerja
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Tiga langkah, satu keputusan.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Tanpa unduhan. Bisa dibuka dari browser di ponsel maupun desktop.
          </p>
        </div>

        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="border-t border-line pt-5">
              <p className="text-compact font-semibold uppercase tracking-[0.16em] text-clay-dark">
                Langkah {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
