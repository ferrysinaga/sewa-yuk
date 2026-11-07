import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/layout/AuthLayout'
import { useToast } from '../components/ui/Toast'
import { getAuthErrorMessage, getDefaultRouteForRole, validateEmail, validatePassword } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import type { UserRole } from '../types/auth'

const baseInputClass =
  'w-full rounded-[6px] border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:ring-2 disabled:cursor-not-allowed disabled:bg-canvas'

function inputClass(hasError: boolean) {
  return `${baseInputClass} ${
    hasError
      ? 'border-danger focus:border-danger focus:ring-danger-soft'
      : 'border-line focus:border-pine focus:ring-pine-soft'
  }`
}

const roleOptions: { value: UserRole; title: string; description: string }[] = [
  { value: 'tenant', title: 'Penyewa', description: 'Cari dan sewa booth event' },
  { value: 'organizer', title: 'Penyelenggara', description: 'Rancang dan kelola event' },
]

export default function Register() {
  const session = useAuthStore((state) => state.session)
  const activeRole = useAuthStore((state) => state.role)
  const initialized = useAuthStore((state) => state.initialized)
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [role, setRole] = useState<UserRole>('tenant')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false, confirmPassword: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const emailError = validateEmail(email)
  const passwordError = validatePassword(password)
  const confirmPasswordError = !confirmPassword
    ? 'Konfirmasi kata sandi wajib diisi.'
    : confirmPassword !== password
      ? 'Konfirmasi kata sandi tidak cocok.'
      : ''

  const visibleEmailError = (touched.email || submitAttempted) && emailError
  const visiblePasswordError = (touched.password || submitAttempted) && passwordError
  const visibleConfirmError = (touched.confirmPassword || submitAttempted) && confirmPasswordError

  if (initialized && session) {
    return <Navigate to={getDefaultRouteForRole(activeRole)} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)

    if (emailError || passwordError || confirmPasswordError) {
      showToast('Periksa kembali data pendaftaran Anda.', 'error')
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { role },
        },
      })

      if (error) throw error

      if (data.session) {
        showToast('Akun berhasil dibuat. Mengalihkan ke halaman Anda…', 'success')
        navigate(getDefaultRouteForRole(role), { replace: true })
        return
      }

      showToast('Pendaftaran berhasil. Periksa email Anda untuk konfirmasi akun.', 'success')
      navigate('/login', { replace: true })
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="rounded-[10px] border border-line bg-surface p-6 sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-clay" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Akun baru
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Buat akun baru
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Pilih peran Anda untuk mendapatkan pengalaman yang sesuai.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-6 rounded-[6px] border border-line bg-clay-soft px-4 py-3 text-xs leading-relaxed text-clay-dark">
            Supabase belum dikonfigurasi. Salin <code className="font-semibold">.env.example</code> menjadi{' '}
            <code className="font-semibold">.env</code> lalu isi kredensial proyek Anda.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Daftar sebagai</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {roleOptions.map((option) => {
                const isSelected = role === option.value

                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-[8px] border p-3 text-left transition-colors focus-within:ring-2 focus-within:ring-pine focus-within:ring-offset-2 focus-within:ring-offset-surface motion-reduce:transition-none ${
                      isSelected
                        ? 'border-pine bg-pine-soft'
                        : 'border-line bg-surface hover:border-pine'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setRole(option.value)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{option.title}</span>
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isSelected ? 'border-pine bg-pine' : 'border-line bg-surface'
                        }`}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">{option.description}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink">
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
              <p id="email-error" className="mt-1.5 text-xs text-danger-dark">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Kata sandi
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
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
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[4px] p-2 text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine motion-reduce:transition-none"
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
              <p id="password-error" className="mt-1.5 text-xs text-danger-dark">
                {passwordError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="text-sm font-medium text-ink">
              Konfirmasi kata sandi
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Ulangi kata sandi"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
              aria-invalid={Boolean(visibleConfirmError)}
              aria-describedby={visibleConfirmError ? 'confirm-password-error' : undefined}
              className={`mt-1.5 ${inputClass(Boolean(visibleConfirmError))}`}
            />
            {visibleConfirmError && (
              <p id="confirm-password-error" className="mt-1.5 text-xs text-danger-dark">
                {confirmPasswordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-pine px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
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
              'Buat akun'
            )}
          </button>
        </form>

        <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
          Sudah punya akun?{' '}
          <Link
            to="/login"
            className="rounded-[4px] font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            Masuk
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-[4px] text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
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
