import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '../../store/useAuthStore'
import type { UserRole } from '../../types/auth'

const fakeSession = { access_token: 'token' } as Session

function setAuthState({
  session = null,
  role = null,
  loading = false,
}: {
  session?: Session | null
  role?: UserRole | null
  loading?: boolean
}) {
  useAuthStore.setState({
    session,
    user: null,
    role,
    loading,
    initialized: true,
  })
}

function renderProtectedRoute(allowedRoles: UserRole[] = ['tenant']) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/protected" element={<p>Halaman terproteksi</p>} />
        </Route>
        <Route path="/login" element={<p>Halaman login</p>} />
        <Route path="/event" element={<p>Halaman event</p>} />
        <Route path="/admin" element={<p>Halaman admin</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      role: null,
      loading: false,
      initialized: true,
    })
  })

  it('menampilkan status memeriksa sesi saat loading', () => {
    setAuthState({ session: fakeSession, role: 'tenant', loading: true })

    renderProtectedRoute()

    expect(screen.getByRole('status')).toHaveTextContent('Memeriksa sesi Anda…')
    expect(screen.queryByText('Halaman terproteksi')).not.toBeInTheDocument()
  })

  it('mengalihkan ke login bila belum ada sesi', () => {
    setAuthState({})

    renderProtectedRoute()

    expect(screen.getByText('Halaman login')).toBeInTheDocument()
  })

  it('menampilkan halaman bila role diizinkan', () => {
    setAuthState({ session: fakeSession, role: 'tenant' })

    renderProtectedRoute(['tenant'])

    expect(screen.getByText('Halaman terproteksi')).toBeInTheDocument()
  })

  it('mengalihkan tenant ke halaman event saat membuka route organizer', () => {
    setAuthState({ session: fakeSession, role: 'tenant' })

    renderProtectedRoute(['organizer'])

    expect(screen.getByText('Halaman event')).toBeInTheDocument()
  })

  it('mengalihkan organizer ke halaman admin saat membuka route tenant', () => {
    setAuthState({ session: fakeSession, role: 'organizer' })

    renderProtectedRoute(['tenant'])

    expect(screen.getByText('Halaman admin')).toBeInTheDocument()
  })
})
