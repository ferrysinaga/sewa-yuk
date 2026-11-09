/** Kelas dasar input form autentikasi (Login dan Register). */
export const baseInputClass =
  'w-full rounded-[6px] border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:ring-2 disabled:cursor-not-allowed disabled:bg-canvas'

/** Kelas input dengan warna border/focus sesuai state validasi. */
export function inputClass(hasError: boolean): string {
  return `${baseInputClass} ${
    hasError
      ? 'border-danger focus:border-danger focus:ring-danger-soft'
      : 'border-line focus:border-pine focus:ring-pine-soft'
  }`
}
