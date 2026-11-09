# Panduan Pengembangan Front-End: Platform Booking Booth "sewa-yuk"

Dokumen ini memuat spesifikasi arsitektur antarmuka, manajemen state, pedoman desain, dan cara kerja iterasi untuk pengembangan Single Page Application (SPA) di atas Vite + TypeScript yang sudah diinisialisasi pada repositori.

Dokumen ini bukan kontrak yang harus diikuti buta. Anggap sebagai arah kerja: kalau sebuah aturan membuat alur pemesanan lebih lambat atau lebih sulit dipahami, aturan itu yang salah, bukan penggunanya.

---

## 0. Prinsip Kerja

Empat prinsip ini yang menyelesaikan 90% keputusan desain dan teknis di proyek ini:

1. **Peta dulu, dekorasi belakangan.** Kalau sebuah elemen tidak membantu orang memilih booth atau mengelola tata letak, elemen itu kandidat untuk dihapus.
2. **Satu iterasi, satu perubahan.** Jangan menambah fitur sambil merombak struktur. Pisahkan, kerjakan berurutan, verifikasi di tiap langkah.
3. **Kalau ragu, kurangi.** Warna lebih sedikit, animasi lebih sedikit, abstraksi lebih sedikit. Kesederhanaan yang konsisten lebih sulit ditiru daripada kompleksitas.
4. **Ukur, jangan menebak.** "Terasa lambat" bukan temuan. Buka DevTools, ukur, baru ubah.

---

## 1. Tumpukan Teknologi (Tech Stack)

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| Build & Framework | Vite + React + TypeScript | Entry point `src/main.tsx`, bukan `src/main.ts`. |
| Routing | `react-router-dom` | Pisahkan rute `/admin` dan `/event/:id`. |
| Styling | Tailwind CSS via PostCSS | Dikonfigurasi dari `src/style.css`; token warna di `:root`. |
| State | Zustand | Selector sempit wajib; hindari subscribe ke seluruh store. |
| Drag & Drop | `@dnd-kit/core` | Hanya untuk kanvas admin. |
| Backend | `@supabase/supabase-js` | Realtime untuk status booth. |

Aturan dependensi:

- Jangan menambah pustaka untuk hal yang bisa diselesaikan 20 baris kode (format tanggal, debounce, class merge).
- Setiap dependensi baru harus menjawab: apa yang rusak tanpanya, dan berapa biaya perawatannya enam bulan lagi.
- Kunci versi di `package.json`. Repositori yang tidak bisa di-install ulang adalah utang, bukan proyek.

---

## 2. Struktur Direktori Klien

Kembangkan repositori dari struktur dasar `src/main.tsx` menjadi hierarki berikut:

```text
src/
  components/
    ui/        # Button, Card, Dropdown, Dialog, EmptyState
    map/       # InteractiveMap.tsx, BoothRect.tsx, MapLegend.tsx, MapControls.tsx
  pages/       # AdminDashboard.tsx, EventTenant.tsx
  store/       # useBoothStore.ts
  lib/         # supabase.ts, realtime.ts, format.ts
  types/       # booth.ts (tipe domain bersama)
```

Aturan tambahan:

- **Jangan buat `index.ts` (barrel file) di setiap folder.** Impor langsung ke file. Barrel file memperlambat build, menyamarkan dependensi melingkar, dan menyulitkan pencarian "file ini dipakai di mana".
- Satu komponen satu file. Kalau sebuah file melewati ~200 baris, tanyakan apakah ada tanggung jawab yang bisa dipisah—bukan sekadar memotong file jadi dua.
- `lib/` untuk kode yang tidak tahu apa-apa tentang React. Kalau butuh hook, tempatnya bukan di `lib/`.
- `types/` menyimpan tipe domain yang dipakai lintas lapisan (store, komponen, realtime). Tipe yang hanya dipakai satu komponen boleh tinggal di file komponen itu.

---

## 3. Manajemen State Spasial (Zustand)

Gunakan Zustand untuk mengelola koordinat booth. Tujuannya bukan "supaya pakai Zustand", tapi supaya pergeseran satu booth tidak merender ulang seluruh peta.

```ts
// src/types/booth.ts
export type BoothStatus = 'Available' | 'Reserved' | 'Booked';
export type BoothCategory = 'Tech' | 'F&B' | 'Apparel';

export interface Booth {
  id: string;
  blueprintId: string;
  name: string;
  category: BoothCategory;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  price: number;
  status: BoothStatus;
}
```

```ts
// src/store/useBoothStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Booth, BoothStatus } from '../types/booth';

interface BoothStore {
  booths: Booth[];
  activeBoothId: string | null;
  setBooths: (booths: Booth[]) => void;
  updateBoothPosition: (id: string, x: number, y: number) => void;
  updateBoothStatus: (id: string, status: BoothStatus) => void;
  setActiveBooth: (id: string | null) => void;
}

export const useBoothStore = create<BoothStore>()(
  devtools(
    (set) => ({
      booths: [],
      activeBoothId: null,
      setBooths: (booths) => set({ booths }, false, 'booths/set'),
      updateBoothPosition: (id, x, y) =>
        set(
          (state) => ({
            booths: state.booths.map((b) =>
              b.id === id ? { ...b, positionX: x, positionY: y } : b,
            ),
          }),
          false,
          'booths/updatePosition',
        ),
      updateBoothStatus: (id, status) =>
        set(
          (state) => ({
            booths: state.booths.map((b) =>
              b.id === id ? { ...b, status } : b,
            ),
          }),
          false,
          'booths/updateStatus',
        ),
      setActiveBooth: (id) => set({ activeBoothId: id }, false, 'booths/setActive'),
    }),
    { name: 'booth-store' },
  ),
);

// Selector sempit: komponen hanya berlangganan potongan yang ia butuhkan.
export const useBoothById = (id: string | null) =>
  useBoothStore((s) => (id ? (s.booths.find((b) => b.id === id) ?? null) : null));

export const useBoothIds = () =>
  useBoothStore(useShallow((s) => s.booths.map((b) => b.id)));
```

Catatan penting:

- **Jangan** `const booths = useBoothStore((s) => s.booths)` di komponen yang hanya butuh satu booth. Gunakan `useBoothById`.
- **Jangan** menyimpan nilai turunan (mis. `availableCount`, `selectedBooth` lengkap) di state. Hitung dari sumbernya, atau bungkus di selector dengan `useMemo` bila benar-benar mahal.
- `useShallow` tersedia di Zustand v4.4+ / v5. Bila proyek memakai versi lebih lama, gunakan `shallow` dari `zustand/shallow` sebagai argumen kedua.
- State ini adalah *cache klien*, bukan sumber kebenaran. Sumber kebenaran ada di Supabase; store hanya menyimpan salinan terbaru untuk dirender.

---

## 4. Render Kanvas SVG Interaktif

### Sisi admin

Bungkus area `<svg>` dengan `<DndContext>` dari `@dnd-kit/core`. Pada `onDragEnd`, konversi delta layar ke koordinat kanvas (bagi dengan skala zoom), lalu panggil `updateBoothPosition(id, x, y)`.

Jangan simpan posisi sementara di state terpisah saat menyeret. Simpan di store, dan biarkan selector per-booth yang menangani render. Kalau drag terasa berat, itu tanda `BoothRect` tidak di-`memo` atau selector terlalu lebar—bukan alasan menambah state.

### Sisi penyewa

Render array booth menjadi elemen `<rect>` dengan `rx={8}`. Setiap booth dibungkus `<g>` yang bisa difokus, agar interaksi dan aksesibilitas tidak bergantung pada `<rect>` semata.

```tsx
// src/components/map/BoothRect.tsx
import { memo } from 'react';
import { useBoothStore } from '../../store/useBoothStore';
import type { Booth } from '../../types/booth';

const statusClass: Record<Booth['status'], string> = {
  Available: 'fill-[var(--color-surface)] stroke-[var(--color-pine)]',
  Reserved: 'fill-[color-mix(in_srgb,var(--color-terracotta)_12%,transparent)] stroke-[var(--color-terracotta)]',
  Booked: 'fill-[var(--color-muted-surface)] stroke-[var(--color-line-strong)]',
};

export const BoothRect = memo(function BoothRect({ booth }: { booth: Booth }) {
  const isActive = useBoothStore((s) => s.activeBoothId === booth.id);
  const setActiveBooth = useBoothStore((s) => s.setActiveBooth);
  const disabled = booth.status === 'Booked';

  const select = () => {
    if (!disabled) setActiveBooth(booth.id);
  };

  return (
    <g
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isActive}
      aria-disabled={disabled}
      aria-label={`${booth.name}, ${booth.category}, ${booth.status}`}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      }}
      className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
    >
      <rect
        x={booth.positionX}
        y={booth.positionY}
        width={booth.width}
        height={booth.height}
        rx={8}
        strokeWidth={isActive ? 3 : 1.5}
        className={statusClass[booth.status]}
      />
      <text
        x={booth.positionX + booth.width / 2}
        y={booth.positionY + booth.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="pointer-events-none fill-[var(--color-ink)] text-[11px] tabular-nums"
      >
        {booth.name}
      </text>
    </g>
  );
});
```

### Performa peta

- `BoothRect` **wajib** `memo`. Props-nya harus stabil; jangan meneruskan objek baru setiap render.
- Untuk pan/zoom, ubah `transform` pada `<g>` pembungkus, bukan koordinat tiap booth.
- Di bawah ~500 booth, SVG masih nyaman. Di atas itu, pertimbangkan `<canvas>`—tapi jangan lakukan sebelum ada bukti masalah.
- Hindari animasi pada atribut SVG (`x`, `y`, `width`). Animasi `transform`/`opacity` jauh lebih murah.
- Jangan memakai `filter: drop-shadow` pada banyak elemen sekaligus. Biayanya mahal dan hasilnya terlihat seperti template.

---

## 5. Arah Visual dan Sistem Desain

Buat antarmuka terasa seperti **katalog acara dan alat kerja operator**, bukan template dashboard generik. Peta booth adalah konten utama; informasi acara, kapasitas, harga, dan status membantu pengguna mengambil keputusan. Gunakan ruang kosong dan hierarki yang jelas, bukan dekorasi atau kartu untuk setiap potongan informasi.

### Karakter visual

- Gunakan dasar warna hangat `#F7F6F2`, teks gelap `#222923`, hijau pinus `#285C4D` sebagai warna aksi, dan terracotta `#C66B4E` sebagai aksen terbatas. Simpan abu-abu netral untuk garis dan informasi sekunder.
- Hindari gradien dekoratif, blur/glassmorphism, bayangan tebal, ikon emoji, dan warna neon. Jangan menerapkan satu warna aksen ke semua elemen; pakai warna untuk tindakan utama dan petunjuk status saja.
- Gunakan satu sans-serif yang mudah dibaca untuk UI. Buat judul acara lebih ekspresif lewat ukuran dan bobot, bukan dengan menambah jenis font.
- Pakai angka tabular (`font-variant-numeric: tabular-nums`) untuk harga dan ukuran booth agar kolom tidak "menari".
- Radius kecil hingga sedang secara konsisten (6–10 px). Bedakan permukaan dengan garis tipis dan jarak; jangan membungkus setiap bagian dalam card bulat. Bayangan hanya untuk menu mengambang atau dialog yang memang berada di atas konten.

### Token warna

Definisikan token di `src/style.css`, bukan menyebar nilai hex di komponen:

```css
:root {
  --color-canvas: #f7f6f2;
  --color-surface: #fffefb;
  --color-ink: #222923;
  --color-muted: #6b7269;
  --color-line: #ddd9d0;
  --color-line-strong: #c4c0b6;
  --color-pine: #285c4d;
  --color-pine-strong: #1f493d;
  --color-terracotta: #c66b4e;
  --color-muted-surface: #e6e4de;

  --radius-sm: 6px;
  --radius-md: 10px;
}
```

Token ini yang dipakai di Tailwind (`theme.extend.colors`) maupun langsung di SVG. Kalau sebuah warna tidak punya nama di sini, kemungkinan besar warna itu tidak dibutuhkan.

### Komposisi halaman

- **Halaman penyewa:** identitas acara dan lokasi/tanggal di bagian atas, lalu peta sebagai fokus utama. Letakkan legenda status, kontrol zoom, dan ringkasan pilihan dekat dengan peta. Detail booth yang dipilih muncul dalam panel ringkas berisi ukuran, kategori, harga, dan tombol pemesanan yang jelas.
- **Dashboard admin:** utamakan nama acara, ringkasan angka yang benar-benar berguna (mis. terjual / tersedia / menunggu konfirmasi), lalu kanvas tata letak dengan kontrol edit yang mudah ditemukan. Pisahkan aksi berisiko seperti menghapus booth dari aksi rutin, dan minta konfirmasi sebelum menghapus.
- Batasi lebar teks panjang (≤ 70 karakter per baris), gunakan alignment dan jarak yang konsisten, serta hindari KPI, grafik, atau label yang tidak membantu alur pemesanan/pengelolaan.

### Peta dan status booth

- Pertahankan denah sebagai satu bidang yang mudah dipindai. Tampilkan nomor/nama booth bila ruang mencukupi, dan jangan mengandalkan warna saja untuk menyampaikan status.
- Bedakan status dengan kombinasi warna, label/legenda, dan keadaan interaksi:
  - **Tersedia:** permukaan terang, outline hijau.
  - **Dipilih:** outline lebih tebal plus indikator pilihan (mis. cincin luar atau tanda cek).
  - **Dipesan:** permukaan abu-abu, label nonaktif, tidak menerima aksi pemesanan.
- Pastikan kontras tetap cukup dan status terbaca tanpa hover.
- Booth yang tidak tersedia tetap boleh menampilkan alasan/status, tetapi tidak menawarkan aksi pemesanan.

---

## 6. Interaksi, Responsif, dan Aksesibilitas

- Gunakan transisi singkat (120–180 ms) hanya untuk perubahan yang membantu orientasi, misalnya pilihan booth atau pembukaan panel. Hindari animasi berulang dan efek hover yang menggeser tata letak.
- Pada layar sempit, sediakan kontrol peta yang dapat dijangkau, panel detail yang berubah menjadi drawer atau bagian di bawah peta, dan ringkasan harga yang tetap terlihat tanpa menutupi denah.
- Semua tindakan harus bisa dijalankan dengan keyboard, punya fokus yang terlihat, label aksesibel, dan target sentuh memadai (minimal 44×44 px untuk kontrol utama).
- Jangan mengandalkan warna, hover, atau ikon tanpa teks sebagai satu-satunya petunjuk.
- Gunakan `aria-pressed` untuk toggle, `aria-live="polite"` untuk perubahan status yang penting, dan `sr-only` untuk teks yang hanya relevan bagi pembaca layar.
- Hormati `prefers-reduced-motion`: matikan transisi non-esensial, jangan hanya mempercepatnya.
- Tampilkan status loading, kosong, gagal, dan berhasil dengan pesan spesifik—bukan sekadar spinner atau perubahan warna. Contoh: "Belum ada booth di area ini" lebih baik daripada "No data".

---

## 7. Sinkronisasi Supabase Realtime

Karena arsitektur berjalan di sisi klien (CSR), bentrokan data harus dikelola dengan pendengar basis data langsung.

```ts
// src/lib/realtime.ts
import { supabase } from './supabase';
import { useBoothStore } from '../store/useBoothStore';
import type { BoothStatus } from '../types/booth';

export function subscribeToBlueprint(blueprintId: string) {
  const channel = supabase
    .channel(`booths:${blueprintId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'booths',
        filter: `blueprint_id=eq.${blueprintId}`,
      },
      ({ new: row }) => {
        useBoothStore
          .getState()
          .updateBoothStatus(row.id, row.status as BoothStatus);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
```

Alur yang benar:

1. Inisialisasi channel di layout utama atau hook khusus; **selalu** kembalikan fungsi cleanup.
2. Dengarkan `UPDATE` pada tabel `booths`, difilter per `blueprint_id`.
3. Saat payload diterima (mis. pengguna lain menekan "Checkout" dan status berubah menjadi `Reserved`), segera mutasi state agar booth meredup di layar pengguna saat ini—mencegah pemesanan ganda.
4. Untuk aksi pengguna sendiri, lakukan **optimistic update** lalu rollback bila request gagal. Jangan menunggu realtime untuk perubahan yang dipicu pengguna itu sendiri.

Hal yang sering terlewat:

- **Race condition:** dua orang menekan "Checkout" hampir bersamaan. Jangan hanya mengandalkan state klien. Server harus menolak perubahan status yang tidak valid (mis. `Booked` → `Reserved`), dan UI harus menampilkan kegagalan itu dengan jelas.
- **Koneksi putus:** realtime bisa terlewat saat tab tidur atau jaringan putus. Setelah reconnecting, lakukan refetch satu kali, jangan mengandalkan event yang mungkin hilang.
- **Cleanup:** channel yang tidak di-`removeChannel` akan menumpuk setiap kali rute berpindah.
- **Jangan** memakai kembali objek payload mentah sebagai state. Petakan ke tipe domain, validasi field yang dipakai.

---

## 8. Menghilangkan "AI Slop"

"AI slop" adalah hasil yang *terlihat jadi* tetapi terasa generik, berlebihan, dan tidak dipikirkan. Ciri utamanya: banyak elemen, sedikit keputusan. Bagian ini adalah daftar periksa untuk menghapusnya.

### 8.1 Slop visual

| Tanda | Ganti dengan |
| --- | --- |
| Gradien ungu/biru, glassmorphism, glow | Permukaan solid, garis tipis, kontras dari tipografi |
| Setiap bagian dibungkus card `rounded-3xl` + `shadow-xl` | Satu bidang, pemisah berupa garis/jarak |
| Emoji sebagai ikon | Ikon SVG sederhana atau teks label |
| Grid 4 KPI tanpa makna | 2–3 angka yang benar-benar dipakai untuk mengambil keputusan |
| Avatar stok, nama "John Doe", lorem ipsum | Data nyata atau state kosong yang jujur |
| Ilustrasi/blob hero generik | Langsung tampilkan peta atau konten inti |
| Hover `scale-105`/`translate-y` di semua elemen | Perubahan warna/border yang tenang |
| Dark mode otomatis tanpa alasan | Satu tema yang dipoles benar |
| Semua teks bold dan berwarna | Hierarki lewat ukuran, bobot, dan ruang |

### 8.2 Slop kode

- **`any` dan `as` untuk membungkam TypeScript.** Kalau tipe sulit, itu informasi: strukturnya mungkin salah.
- **Komentar yang mengulang kode.** `// increment counter` tidak menambah apa pun. Komentar menjelaskan *mengapa*, bukan *apa*.
- **Abstraksi prematur.** Jangan membuat `useGenericManager`, `BaseComponent`, atau wrapper untuk pemakaian sekali. Tunggu sampai ada dua kasus nyata.
- **`useEffect` untuk segalanya**, termasuk nilai turunan. Hitung saat render; efek hanya untuk sinkronisasi dengan dunia luar.
- **State duplikat.** Menyimpan `selectedBooth` lengkap padahal sudah ada `activeBoothId` adalah sumber bug sinkronisasi.
- **Fetch di dalam render** atau di dalam handler tanpa pembatalan.
- **Error ditelan** dengan `console.log` atau `catch {}`.
- **File 800 baris** yang menangani fetch, format, render, dan modal sekaligus.
- **`!important` dan inline style** untuk menambal konflik Tailwind.
- **Nama kabur**: `data`, `item`, `temp`, `handleClick`, `utils2`.

### 8.3 Slop copy

- "Something went wrong" → sebutkan apa yang gagal dan langkah berikutnya.
- Tombol "Submit" → "Pesan booth ini", "Simpan tata letak".
- Toast "Success!" tanpa detail → "Booth A-12 ditandai sebagai dipesan."
- Bahasa pemasaran kosong ("Seamlessly elevate your experience") → bahasa operator ("12 booth tersedia, 3 menunggu konfirmasi").

### 8.4 Slop motion

- Spinner berputar terus tanpa progres.
- Animasi masuk untuk setiap elemen saat scroll.
- Parallax dan efek dekoratif lain yang tidak membantu orientasi.
- Transisi lebih dari ~200 ms untuk interaksi langsung.

### 8.5 Aturan praktis

Sebelum menambah elemen, tanyakan tiga hal:

1. Apa keputusan yang dibantu elemen ini?
2. Apa yang terjadi kalau elemen ini dihapus?
3. Apakah pengguna akan menyadari kehilangannya?

Kalau jawabannya "tidak yakin" untuk nomor 1 dan "tidak ada" untuk nomor 2, hapus.

---

## 9. Siklus Iterasi

Iterasi yang baik kecil, terukur, dan meninggalkan jejak. Iterasi yang buruk adalah menulis ulang semuanya lalu berharap hasilnya lebih baik.

### 9.1 Loop kerja

1. **Amati.** Gunakan aplikasi seperti pengguna. Catat satu masalah konkret—bukan "kurang modern", tapi "di layar 375 px panel detail menutupi legenda".
2. **Pilih satu.** Jangan memperbaiki lima hal sekaligus.
3. **Ubah minimal.** Sentuh sesedikit mungkin file. Perbaikan yang butuh 300 baris untuk masalah 10 menit biasanya salah pendekatan.
4. **Verifikasi.** Cek di ukuran layar sempit dan lebar, dengan keyboard, dan dengan data kosong.
5. **Catat.** Tulis apa yang berubah dan apa yang belum. Iterasi berikutnya dimulai dari sini.

### 9.2 Aturan iterasi

- Jangan merombak struktur sambil menambah fitur.
- Jangan mengubah desain dan logika data pada iterasi yang sama.
- Commit kecil dengan pesan yang menjelaskan *perilaku*, bukan *file*: "panel detail bisa ditutup dengan Esc", bukan "update EventTenant.tsx".
- Simpan tangkapan layar sebelum/sesudah untuk perubahan visual. Mata menipu ingatan.
- Kalau sebuah perubahan tidak bisa dijelaskan dalam satu kalimat, pecah.

### 9.3 Log iterasi (contoh format)

| Iterasi | Masalah | Perubahan | Verifikasi | Status |
| --- | --- | --- | --- | --- |
| 1 | Harga tidak rata di kolom | `tabular-nums` pada tabel & panel | Cek 3 kategori, 375/768/1280 px | Selesai |
| 2 | Keyboard tidak bisa memilih booth | `tabIndex`, `aria-pressed`, handler Enter/Space | Tab + Enter, screen reader | Selesai |
| 3 | Status tertinggal saat realtime putus | Refetch saat `SUBSCRIBED` | Matikan jaringan, nyalakan lagi | Selesai |

Simpan log ini di issue atau `CHANGELOG`—tempatnya tidak penting, yang penting ada.

---

## 10. Perbaikan Umum dan Cara Memperbaikinya

| Gejala | Penyebab umum | Perbaikan |
| --- | --- | --- |
| Seluruh peta render ulang saat satu booth digeser | Selector melebar / `BoothRect` tidak `memo` | `useBoothById`, `memo`, props stabil |
| Drag terasa "berat" dan melompat | Delta layar dipakai langsung sebagai koordinat | Bagi delta dengan skala zoom sebelum update |
| Booth terlihat dipilih setelah diklik tetapi panel kosong | `activeBoothId` menunjuk booth yang sudah dihapus | Turunkan booth aktif dari daftar, tangani `null` |
| Status berubah kembali setelah beberapa detik | Optimistic update tidak di-rollback/refetch | Rollback saat gagal, refetch saat reconnect |
| Teks harga tidak sejajar | Font proporsional | `tabular-nums`, alignment kanan untuk angka |
| Fokus keyboard tidak terlihat | Outline dihapus tanpa pengganti | `focus-visible` dengan ring kontras |
| Panel menutupi peta di mobile | Panel fixed tanpa alokasi ruang | Drawer bottom sheet + padding peta |
| Warna aksen dipakai di mana-mana | Tidak ada hierarki aksi | Aksen hanya untuk aksi utama/status |
| Halaman terasa "kosong" padahal datanya ada | Terlalu banyak dekorasi, konten inti kecil | Perbesar peta, kecilkan hiasan |
| Build lambat / import membingungkan | Barrel file di semua folder | Impor langsung ke file |

---

## 11. Definition of Done

Sebuah perubahan dianggap selesai hanya jika:

- [ ] Berfungsi di 375 px, 768 px, dan 1280 px.
- [ ] Seluruh alur utama bisa diselesaikan dengan keyboard.
- [ ] Fokus terlihat di semua kontrol interaktif.
- [ ] Status booth terbaca tanpa hover dan tanpa mengandalkan warna saja.
- [ ] Tidak ada teks placeholder, emoji ikon, gradien dekoratif, atau `console.log` yang tertinggal.
- [ ] Tidak ada `any`/`as` baru tanpa alasan tertulis.
- [ ] State loading, kosong, gagal, dan berhasil punya pesan spesifik.
- [ ] `prefers-reduced-motion` dihormati.
- [ ] Realtime membersihkan channel saat unmount.
- [ ] Perubahan dijelaskan dalam satu kalimat di commit/PR.

Kalau salah satu belum terpenuhi, pekerjaan belum selesai—meskipun tampilannya sudah "terlihat bagus".
