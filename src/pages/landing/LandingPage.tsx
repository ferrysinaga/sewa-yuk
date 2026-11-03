import { useState } from 'react'

type Category = 'Tech' | 'F&B' | 'Apparel'
type BoothStatus = 'Available' | 'Booked'

interface Booth {
  id: string
  label: string
  category: Category
  price: number
  x: number
  y: number
  width: number
  height: number
  status: BoothStatus
}

const booths: Booth[] = [
  { id: 'A-01', label: 'Booth A-01', category: 'Tech', price: 4500000, x: 24, y: 64, width: 120, height: 76, status: 'Available' },
  { id: 'A-02', label: 'Booth A-02', category: 'F&B', price: 3800000, x: 24, y: 152, width: 120, height: 76, status: 'Available' },
  { id: 'A-03', label: 'Booth A-03', category: 'Apparel', price: 3200000, x: 24, y: 240, width: 120, height: 76, status: 'Booked' },
  { id: 'A-04', label: 'Booth A-04', category: 'Tech', price: 2900000, x: 24, y: 328, width: 120, height: 56, status: 'Available' },
  { id: 'B-01', label: 'Booth B-01', category: 'F&B', price: 6200000, x: 300, y: 64, width: 196, height: 88, status: 'Available' },
  { id: 'B-02', label: 'Booth B-02', category: 'Tech', price: 7400000, x: 300, y: 164, width: 196, height: 88, status: 'Available' },
  { id: 'B-03', label: 'Booth B-03', category: 'Apparel', price: 5100000, x: 300, y: 264, width: 196, height: 88, status: 'Booked' },
]

const categoryFill: Record<Category, string> = {
  Tech: 'fill-blue-50',
  'F&B': 'fill-amber-50',
  Apparel: 'fill-violet-50',
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

const navItems = [
  { label: 'Nilai Jual', href: '#nilai-jual' },
  { label: 'Fitur', href: '#fitur' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
]

const values = [
  {
    title: 'Visualisasi Spasial Presisi',
    description:
      'Penyewa dapat melihat lokasi persis booth, dimensi ruang, dan kategori lingkungan sekitar langsung melalui kanvas 2D.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
      </svg>
    ),
  },
  {
    title: 'Anti Double-Booking',
    description:
      'Teknologi sinkronisasi instan secara otomatis mengunci status ruang sesaat setelah penyewa memasuki halaman pembayaran.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7a4.5 4.5 0 1 0-9 0v3.5M6.75 10.5h10.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    ),
  },
  {
    title: 'Transparansi Penuh',
    description:
      'Setiap elemen booth yang diklik langsung menampilkan detail harga dan spesifikasi teknis di panel informasi.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3h5.864a1.5 1.5 0 0 1 1.454 1.135l.9 3.6a1.5 1.5 0 0 1-.417 1.44L12 13.5l-5.37-4.325a1.5 1.5 0 0 1-.416-1.44l.9-3.6A1.5 1.5 0 0 1 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 13.5V21M9 21h6" />
      </svg>
    ),
  },
]

const steps = [
  {
    title: 'Pilih Pameran',
    description: 'Jelajahi daftar acara yang sedang membuka pendaftaran penyewaan ruang.',
  },
  {
    title: 'Eksplorasi Kanvas',
    description:
      'Klik langsung pada peta blueprint untuk membandingkan posisi strategis dan harga masing-masing booth.',
  },
  {
    title: 'Kunci Posisi',
    description: 'Lakukan reservasi instan untuk mengamankan lokasi sebelum diambil oleh kompetitor.',
  },
]

function BoothMap() {
  const [activeId, setActiveId] = useState<string>('B-02')
  const activeBooth = booths.find((booth) => booth.id === activeId)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Hall A — Jakarta Convention Center</p>
          <p className="text-xs text-gray-500">Pameran Teknologi Nusantara 2026</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Sinkron real-time
        </span>
      </div>

      <div className="bg-gray-50/70 p-4 sm:p-5">
        <svg
          viewBox="0 0 520 400"
          role="img"
          aria-label="Peta blueprint booth Hall A dengan beberapa booth teknologi, makanan, dan pakaian"
          className="h-auto w-full select-none"
        >
          <defs>
            <pattern id="booth-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="520" height="400" rx="16" fill="white" />
          <rect x="0" y="0" width="520" height="400" rx="16" fill="url(#booth-grid)" opacity="0.7" />
          <rect x="0.5" y="0.5" width="519" height="399" rx="16" fill="none" stroke="#e5e7eb" />

          <text x="260" y="34" textAnchor="middle" className="fill-gray-400 text-[10px] font-medium tracking-[0.25em]">
            BLUEPRINT HALL A
          </text>

          <text x="172" y="216" textAnchor="middle" transform="rotate(-90 172 216)" className="fill-gray-300 text-[10px] font-semibold tracking-[0.3em]">
            AISLE UTAMA
          </text>

          {booths.map((booth) => {
            const isActive = booth.id === activeId
            const isBooked = booth.status === 'Booked'

            return (
              <g
                key={booth.id}
                role="button"
                tabIndex={isBooked ? -1 : 0}
                aria-label={`${booth.label}, ${booth.category}, ${formatPrice(booth.price)}, ${
                  isBooked ? 'sudah dipesan' : 'tersedia'
                }`}
                aria-pressed={isActive}
                onClick={() => !isBooked && setActiveId(booth.id)}
                onKeyDown={(event) => {
                  if (!isBooked && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    setActiveId(booth.id)
                  }
                }}
                className={isBooked ? 'cursor-not-allowed' : 'cursor-pointer focus-visible:outline-none'}
              >
                <rect
                  x={booth.x}
                  y={booth.y}
                  width={booth.width}
                  height={booth.height}
                  rx="8"
                  className={
                    isActive
                      ? 'fill-blue-600 stroke-blue-700 transition-colors'
                      : isBooked
                        ? 'fill-gray-100 stroke-gray-200'
                        : `${categoryFill[booth.category]} stroke-gray-300 transition-colors hover:fill-blue-50 hover:stroke-blue-400`
                  }
                  strokeWidth={isActive ? 2 : 1.2}
                />

                <text
                  x={booth.x + 14}
                  y={booth.y + 26}
                  className={`text-[11px] font-semibold ${isActive ? 'fill-white' : isBooked ? 'fill-gray-400' : 'fill-gray-900'}`}
                >
                  {booth.id}
                </text>

                <text
                  x={booth.x + 14}
                  y={booth.y + 44}
                  className={`text-[9px] font-medium ${isActive ? 'fill-blue-100' : isBooked ? 'fill-gray-400' : 'fill-gray-500'}`}
                >
                  {isBooked ? 'Terisi' : booth.category}
                </text>

                {!isBooked && (
                  <text
                    x={booth.x + 14}
                    y={booth.y + booth.height - 14}
                    className={`text-[9px] font-medium ${isActive ? 'fill-white' : 'fill-gray-500'}`}
                  >
                    {formatPrice(booth.price)}
                  </text>
                )}
              </g>
            )
          })}

          <path d="M220 384h80" stroke="#d1d5db" strokeWidth="4" strokeLinecap="round" />
          <path d="M256 372v12" stroke="#d1d5db" strokeWidth="2" strokeDasharray="3 3" />
          <text x="260" y="368" textAnchor="middle" className="fill-gray-400 text-[9px] font-medium tracking-[0.2em]">
            PINTU MASUK
          </text>
        </svg>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-gray-300 bg-white" /> Tersedia
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-blue-700 bg-blue-600" /> Dipilih
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-gray-200 bg-gray-100" /> Terisi
          </span>
        </div>
      </div>

      <div className="border-t border-gray-200 px-5 py-4">
        {activeBooth ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-700">
                {activeBooth.id.split('-')[0]}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeBooth.label}</p>
                <p className="text-xs text-gray-500">
                  {activeBooth.category} · 3 × 3 m · Sudut strategis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">Harga mulai</p>
                <p className="text-sm font-semibold text-gray-900">{formatPrice(activeBooth.price)}</p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Lihat Detail
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Pilih salah satu booth pada kanvas untuk melihat detail.</p>
        )}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.5a1 1 0 0 1-1.42 0l-3.5-3.5a1 1 0 1 1 1.414-1.414l2.793 2.793 6.793-6.793a1 1 0 0 1 1.414 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M9 9v11M15 9v11" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight">sewa-yuk</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:inline-flex"
            >
              Masuk
            </a>
            <a
              href="/event"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Cari Booth
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-indigo-50 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Platform booking booth berbasis peta spasial
              </span>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.4rem]">
                Tinggalkan Denah Statis, Mulai Era Baru Manajemen Booth Event.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
                Platform booking ruang pameran dengan peta spasial interaktif. Pantau ketersediaan, cek harga
                transparan, dan sewa booth secara real-time tanpa risiko bentrokan jadwal.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/event"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Cari Lokasi Booth
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Jadi Penyelenggara Acara
                </a>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-gray-200 pt-8">
                {[
                  { value: '128+', label: 'Event aktif' },
                  { value: '4.2K', label: 'Booth tersewa' },
                  { value: '0', label: 'Double-booking' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-xs font-medium text-gray-500">{stat.label}</dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-blue-50 via-white to-indigo-50" />
              <BoothMap />
            </div>
          </div>
        </section>

        <section id="nilai-jual" className="border-y border-gray-200 bg-gray-50/60 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Nilai Jual Utama</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Denah yang bekerja untuk Anda, bukan sekadar gambar.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                Setiap piksel pada kanvas mewakili data nyata: posisi, harga, dan status terkini.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {values.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg sm:p-7"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    {item.icon}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fitur" className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Untuk Setiap Peran</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Satu platform, dua alur kerja yang dirancang khusus.
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <article className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                    Untuk Organizer
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16M9 9v11M4 15h5" />
                  </svg>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-gray-900">
                  Bangun blueprint acara dalam hitungan menit.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Ruang kerja drag-and-drop bersistem snap-to-grid membuat tata letak booth rapi tanpa perlu
                  perangkat lunak desain tambahan.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-gray-700">
                  {[
                    'Seret, lepas, dan atur booth dengan presisi grid',
                    'Atur kategori, harga, dan dimensi per elemen',
                    'Publikasikan denah langsung ke halaman penyewa',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/admin"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Buka Ruang Kerja
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-600">
                    <path
                      fillRule="evenodd"
                      d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </article>

              <article className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                    Untuk Tenant
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 13.5 13.5 10.5M7.5 16.5l-1.5 1.5a3.536 3.536 0 0 1-5-5l3-3a3.536 3.536 0 0 1 5 0M16.5 7.5 18 6a3.536 3.536 0 0 1 5 5l-3 3a3.536 3.536 0 0 1-5 0" />
                  </svg>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-gray-900">
                  Temukan booth yang tepat tanpa menebak-nebak.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Filter multi-kriteria menyorot booth berdasarkan rentang harga atau kategori spesifik, langsung
                  di atas peta.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(['F&B', 'Teknologi', 'Pakaian', 'Semua'] as const).map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
                        tag === 'Semua'
                          ? 'bg-gray-900 text-white ring-gray-900'
                          : 'bg-white text-gray-600 ring-gray-200'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <ul className="mt-6 space-y-3 text-sm text-gray-700">
                  {[
                    'Sorot booth sesuai kategori dan budget',
                    'Bandingkan posisi strategis secara visual',
                    'Kunci lokasi sebelum diambil kompetitor',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/event"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Jelajahi Event
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </article>
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="border-y border-gray-200 bg-gray-50/60 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Alur Kerja</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Tiga langkah menuju booth impian Anda.
              </h2>
            </div>

            <div className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent md:block"
              />
              {steps.map((step, index) => (
                <div key={step.title} className="relative">
                  <div className="flex flex-col items-center text-center md:items-start md:text-left">
                    <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white text-lg font-semibold text-gray-900 shadow-sm">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-5 text-lg font-semibold text-gray-900">{step.title}</h3>
                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-2xl bg-gray-900 px-6 py-14 shadow-sm sm:px-12 sm:py-16 lg:px-16">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/30 blur-3xl" />
                <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                <svg
                  viewBox="0 0 200 200"
                  className="absolute right-6 top-1/2 hidden h-64 w-64 -translate-y-1/2 text-white/5 lg:block"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <rect x="10" y="10" width="55" height="55" rx="6" />
                  <rect x="75" y="10" width="55" height="55" rx="6" />
                  <rect x="10" y="75" width="55" height="55" rx="6" />
                  <rect x="75" y="75" width="115" height="115" rx="6" />
                  <rect x="140" y="10" width="50" height="55" rx="6" />
                </svg>
              </div>

              <div className="relative max-w-2xl">
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Ruang Strategis Terbatas. Rancang Event atau Amankan Booth Anda Hari Ini.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-300">
                  Bergabung bersama organizer dan tenant yang sudah meninggalkan denah statis. Mulai dalam
                  hitungan menit, tanpa instalasi.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/event"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    Mulai Eksplorasi Event
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path
                        fillRule="evenodd"
                        d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                  <a
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    Jadi Penyelenggara
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M9 9v11M15 9v11" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-gray-900">sewa-yuk</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Navigasi footer">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {item.label}
              </a>
            ))}
            <a
              href="/admin"
              className="text-sm text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Untuk Organizer
            </a>
          </nav>
          <p className="text-xs text-gray-400">© 2026 sewa-yuk. Semua hak dilindungi.</p>
        </div>
      </footer>
    </div>
  )
}
