import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useToast } from '../ui/Toast'
import {
  BLUEPRINT_IMAGE_ACCEPT,
  BLUEPRINT_IMAGE_MAX_BYTES,
  getBlueprintImageErrorMessage,
  removeBlueprintImage,
  uploadBlueprintImage,
  validateBlueprintImage,
} from '../../lib/storage'
import { isSupabaseConfigured } from '../../lib/supabase'

interface BlueprintImageUploaderProps {
  blueprintId: string
  imageUrl: string
  imagePath: string
  savedImagePath: string
  onChange: (image: { url: string; path: string } | null) => void
  disabled?: boolean
}

export default function BlueprintImageUploader({
  blueprintId,
  imageUrl,
  imagePath,
  savedImagePath,
  onChange,
  disabled = false,
}: BlueprintImageUploaderProps) {
  const { showToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const removeUnsavedImage = async () => {
    if (!imagePath || imagePath === savedImagePath) return

    try {
      await removeBlueprintImage(imagePath)
    } catch (cleanupError) {
      console.warn('Gagal menghapus gambar yang belum tersimpan:', getBlueprintImageErrorMessage(cleanupError))
    }
  }

  const openFilePicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    const validationError = validateBlueprintImage(file)

    if (validationError) {
      setError(validationError)
      showToast(validationError, 'error')
      return
    }

    if (!isSupabaseConfigured) {
      const message = 'Supabase belum dikonfigurasi. Tidak dapat mengunggah gambar.'
      setError(message)
      showToast(message, 'error')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const uploaded = await uploadBlueprintImage(blueprintId, file)
      onChange({ url: uploaded.url, path: uploaded.path })
      void removeUnsavedImage()
      showToast('Gambar denah berhasil diunggah. Simpan perubahan untuk menerapkannya.', 'success')
    } catch (uploadError) {
      const message = getBlueprintImageErrorMessage(uploadError)
      setError(message)
      showToast(message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (disabled || uploading) return
    onChange(null)
    void removeUnsavedImage()
    setError(null)
    showToast('Gambar akan dihapus setelah perubahan disimpan.', 'info')
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-700">Gambar denah</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Opsional. Tampil sebagai latar kanvas dan cover event tenant.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600 ring-1 ring-inset ring-gray-200">
          Maks {Math.round(BLUEPRINT_IMAGE_MAX_BYTES / (1024 * 1024))} MB
        </span>
      </div>

      <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt="Pratinjau gambar denah"
              className="aspect-[1000/640] w-full bg-gray-100 object-contain"
            />
            <span className="absolute left-2 top-2 rounded-full bg-gray-900/75 px-2.5 py-1 text-[10px] font-semibold text-white">
              Latar kanvas &amp; cover
            </span>
          </div>
        ) : (
          <div className="flex aspect-[1000/640] flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z"
                />
              </svg>
            </span>
            <p className="text-xs font-semibold text-gray-900">Belum ada gambar denah</p>
            <p className="max-w-xs text-[11px] leading-relaxed text-gray-500">
              Unggah denah venue agar tenant mendapat gambaran tata letak. Booth tetap dapat
              dipilih langsung dari kanvas interaktif.
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={disabled || uploading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
              />
              Mengunggah...
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V5.56l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 0 0 1.06 1.06l1.72-1.72v7.69Z" />
                <path d="M3.5 15.75a.75.75 0 0 0 0 1.5h13a.75.75 0 0 0 0-1.5h-13Z" />
              </svg>
              {imageUrl ? 'Ganti gambar' : 'Pilih gambar'}
            </>
          )}
        </button>

        {imageUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || uploading}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hapus gambar
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={BLUEPRINT_IMAGE_ACCEPT}
        onChange={(event) => void handleFileChange(event)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <p className="mt-2 text-[11px] text-gray-500">
        Gunakan JPG, PNG, atau WEBP. Rasio ideal 1000 × 640 agar sejajar dengan kanvas booth.
      </p>

      {error && (
        <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
