import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../lib/api/client'
import { currentUser, login, logout, register } from './api'
import type { User } from './api'

const buttonClass = 'rounded-lg bg-lime-300 px-5 py-3 text-sm font-bold text-violet-950 hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300 disabled:cursor-wait disabled:opacity-60'

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'invalid_credentials') return 'The email or password is incorrect.'
    if (error.status === 422) return 'Please check the highlighted fields.'
    if (error.code === 'csrf_cookie_missing') return 'Your browser did not accept the session cookie. Allow cookies for this site and try again.'
    if (error.status === 419) return 'Your session has expired. Please try again.'
    if (error.status === 429) return 'Too many attempts. Please wait a minute before trying again.'
    if (error.code === 'already_authenticated') return 'You are already signed in. Refresh to view your account.'
  }
  return 'We couldn’t complete that request. Please try again. If you just created an account, try signing in.'
}

export function AuthPanel({ onSessionChange }: { onSessionChange?: (user: User | null) => void } = {}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const controller = new AbortController()
    currentUser(controller.signal).then(
      account => { if (!controller.signal.aborted) { setUser(account); setLoading(false) } },
      error => {
        if (!controller.signal.aborted) {
          setLoadError(!(error instanceof ApiError && error.status === 401))
          setLoading(false)
        }
      },
    )
    return () => controller.abort()
  }, [attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const credentials = { email: String(values.get('email')), password: String(values.get('password')) }
    setBusy(true); setMessage(''); setErrors({}); setNotice('')
    try {
      const account = mode === 'login'
        ? await login(credentials)
        : await register({ ...credentials, name: String(values.get('name')), password_confirmation: String(values.get('password_confirmation')) })
      form.reset()
      setUser(account)
      onSessionChange?.(account)
    } catch (error) {
      setMessage(errorMessage(error))
      if (error instanceof ApiError) setErrors(error.fields)
    } finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true); setMessage('')
    try {
      await logout()
      setUser(null); setNotice('You have been signed out.')
      onSessionChange?.(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null); setNotice('Your session has ended. Please sign in again.')
        onSessionChange?.(null)
      } else setMessage(errorMessage(error))
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="account-heading" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
      <h2 id="account-heading" className="mb-5 text-2xl font-bold">{user ? `Welcome, ${user.name}` : 'Your player account'}</h2>
      {loading ? <p role="status">Checking your account…</p> : loadError ? (
        <div><p role="alert" className="mb-4 text-rose-200">We couldn’t check your account.</p><button className={buttonClass} onClick={() => { setLoading(true); setLoadError(false); setAttempt(value => value + 1) }}>Retry</button></div>
      ) : user ? (
        <div>
          <p className="mb-6 break-words text-violet-200">You’re signed in as {user.email}.</p>
          <button type="button" onClick={signOut} disabled={busy} className={buttonClass}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex gap-3" aria-label="Account action">
            {(['login', 'register'] as const).map(action => (
              <button key={action} type="button" disabled={busy} aria-pressed={mode === action} onClick={() => { setMode(action); setMessage(''); setErrors({}); setNotice('') }} className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-lime-300 ${mode === action ? 'bg-violet-600 text-white' : 'text-violet-200 hover:bg-white/10'}`}>
                {action === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          <form key={mode} onSubmit={submit}>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="sr-only">{mode === 'login' ? 'Sign in' : 'Create account'}</legend>
              {(mode === 'register' ? ['name', 'email', 'password', 'password_confirmation'] : ['email', 'password']).map(field => {
                const label = { name: 'Name', email: 'Email address', password: 'Password', password_confirmation: 'Confirm password' }[field]
                const password = field.startsWith('password')
                return (
                  <div key={field}>
                    <label htmlFor={field} className="mb-2 block text-sm font-medium">{label}</label>
                    <input id={field} name={field} type={password ? 'password' : field === 'email' ? 'email' : 'text'} required
                      autoComplete={field === 'name' ? 'name' : field === 'email' ? 'username' : mode === 'login' ? 'current-password' : 'new-password'}
                      minLength={mode === 'register' && password ? 12 : undefined} maxLength={field === 'name' ? 100 : field === 'email' ? 255 : 72}
                      aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined}
                      className="w-full rounded-lg border border-violet-400/40 bg-violet-950 px-3 py-3 text-white outline-none focus:border-lime-300 focus:ring-1 focus:ring-lime-300 disabled:opacity-60" />
                    {errors[field] && <p id={`${field}-error`} className="mt-2 text-sm text-rose-200">{errors[field][0]}</p>}
                  </div>
                )
              })}
              {mode === 'register' && <p className="text-xs leading-5 text-violet-200">Use at least 12 characters for your password.</p>}
              <button type="submit" className={`${buttonClass} w-full`}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in to your account' : 'Create your account'}</button>
            </fieldset>
          </form>
        </>
      )}
      {message && <p role="alert" className="mt-4 text-sm text-rose-200">{message}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-lime-200">{notice}</p>}
    </section>
  )
}
