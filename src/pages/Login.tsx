import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/layout/AuthLayout'
import { useToast } from '../components/ui/Toast'
import { getAuthErrorMessage, getDefaultRouteForRole, getUserRole, validateEmail, validatePassword } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

const baseInputClass =
  'w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50'

function inputClass(hasError: boolean) {
  return `${baseInputClass} ${
    hasError
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-gray-200 focus:border-blue-600 focus:ring-blue-100'
  }`
}

export default function Login() {
  const session = useAuthStore((state) => state.session)
  const role = useAuthStore((state) => state.role)
  const initialized = useAuthStore((state) => state.initialized)
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const emailError = validateEmail(email)
  const passwordError = validatePassword(password)
  const visibleEmailError = (touched.email || submitAttempted) && emailError
  const visiblePasswordError = (touched.password || submitAttempted) && passwordError

  if (initialized && session) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)

    if (emailError || passwordError) {
      showToast('Periksa kembali email dan kata sandi Anda.', 'error')
      return
    }

    if (!isSupabaseConfigured) {
      showToast(
        'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.',
        'error',
      )
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error

      const userRole = getUserRole(data.user)
      const from = (location.state as { from?: string } | null)?.from
      const destination =
        from && from !== '/login' && from !== '/register' ? from : getDefaultRouteForRole(userRole)

      showToast('Berhasil masuk. Mengalihkan ke halaman Anda…', 'success')
      navigate(destination, { replace: true })
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Masuk ke akun Anda</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Kelola booth dan pantau ketersediaan ruang secara real-time.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
            Supabase belum dikonfigurasi. Salin <code className="font-semibold">.env.example</code> menjadi{' '}
            <code className="font-semibold">.env</code> lalu isi kredensial proyek Anda.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-900">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              aria-invalid={Boolean(visibleEmailError)}
              aria-describedby={visibleEmailError ? 'email-error' : undefined}
              className={`mt-1.5 ${inputClass(Boolean(visibleEmailError))}`}
            />
            {visibleEmailError && (
              <p id="email-error" className="mt-1.5 text-xs text-red-600">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-900">
              Kata sandi
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                aria-invalid={Boolean(visiblePasswordError)}
                aria-describedby={visiblePasswordError ? 'password-error' : undefined}
                className={`${inputClass(Boolean(visiblePasswordError))} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
            {visiblePasswordError && (
              <p id="password-error" className="mt-1.5 text-xs text-red-600">
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                Memproses…
              </>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Belum punya akun?{' '}
          <Link
            to="/register"
            className="font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Daftar sekarang
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
              clipRule="evenodd"
            />
          </svg>
          Kembali ke beranda
        </Link>
      </p>
    </AuthLayout>
  )
}
