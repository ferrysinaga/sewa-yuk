interface SpinnerProps {
  /** Ukuran visual spinner. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Warna spinner sesuai latar tempat ia dipakai. Default `pine`. */
  tone?: 'pine' | 'white'
  /** Kelas tambahan dari pemanggil tanpa mengubah ukuran dasar. */
  className?: string
}

const SIZE_CLASS: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-8 w-8',
}

const TONE_CLASS: Record<NonNullable<SpinnerProps['tone']>, string> = {
  pine: 'border-line border-t-pine',
  white: 'border-white/40 border-t-white',
}

/**
 * Spinner tunggal untuk seluruh aplikasi. Selalu dekoratif
 * (`aria-hidden`) dan berhenti berputar saat pengguna meminta
 * `prefers-reduced-motion`.
 */
export default function Spinner({ size = 'md', tone = 'pine', className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 motion-reduce:animate-none ${SIZE_CLASS[size]} ${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}
    />
  )
}
