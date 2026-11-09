import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_DOCUMENT_TITLE, useDocumentTitle } from './useDocumentTitle'

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = DEFAULT_DOCUMENT_TITLE
  })

  it('memakai format "Halaman · sewa-yuk"', () => {
    renderHook(() => useDocumentTitle('Jelajah Event'))

    expect(document.title).toBe('Jelajah Event · sewa-yuk')
  })

  it('memperbarui judul ketika nama halaman berubah', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Detail Event' },
    })

    expect(document.title).toBe('Detail Event · sewa-yuk')

    rerender({ title: 'Hall A' })

    expect(document.title).toBe('Hall A · sewa-yuk')
  })

  it('mengembalikan judul bawaan saat halaman dilepas', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Masuk'))

    expect(document.title).toBe('Masuk · sewa-yuk')

    unmount()

    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE)
  })
})
