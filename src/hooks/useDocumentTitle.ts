import { useEffect } from 'react'

export const DEFAULT_DOCUMENT_TITLE = 'sewa-yuk - Manajemen Booth Event Berbasis Peta Spasial'

/**
 * Tetapkan judul dokumen dengan format "Halaman · sewa-yuk" dan kembalikan
 * judul bawaan saat halaman dilepas atau judul berubah.
 */
export function useDocumentTitle(pageTitle: string | null | undefined): void {
  useEffect(() => {
    if (!pageTitle) return

    document.title = `${pageTitle} · sewa-yuk`

    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE
    }
  }, [pageTitle])
}
