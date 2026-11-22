import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthPanel } from './AuthPanel'
import { ApiError } from '../../lib/api/client'
import * as api from './api'

vi.mock('./api', () => ({ currentUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() }))
const account = { id: 1, name: 'Demo Player', email: 'player@example.test' }

afterEach(() => vi.resetAllMocks())

async function guest() {
  vi.mocked(api.currentUser).mockRejectedValue(new ApiError(401, 'unauthenticated'))
  render(<AuthPanel />)
  await screen.findByRole('button', { name: 'Sign in to your account' })
}

function fillLogin() {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: account.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-demo-password' } })
}

describe('account panel', () => {
  it('restores an existing session without showing the sign-in form', async () => {
    vi.mocked(api.currentUser).mockResolvedValue(account)
    render(<AuthPanel />)
    expect(await screen.findByText('Welcome, Demo Player')).toBeVisible()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('signs in and clears credentials from the form', async () => {
    vi.mocked(api.login).mockResolvedValue(account)
    await guest(); fillLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to your account' }))
    expect(await screen.findByText('Welcome, Demo Player')).toBeVisible()
    expect(api.login).toHaveBeenCalledWith({ email: account.email, password: 'a-long-demo-password' })
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('submits registration and displays server field validation', async () => {
    vi.mocked(api.register).mockRejectedValue(new ApiError(422, 'validation_failed', { email: ['This email is already registered.'] }))
    await guest()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: account.name } })
    fillLogin()
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a-long-demo-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create your account' }))
    expect(await screen.findByText('This email is already registered.')).toBeVisible()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true')
    expect(api.register).toHaveBeenCalledWith({ name: account.name, email: account.email, password: 'a-long-demo-password', password_confirmation: 'a-long-demo-password' })
  })

  it('keeps sign-in failures generic and permits retry', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new ApiError(401, 'invalid_credentials')).mockResolvedValueOnce(account)
    await guest(); fillLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to your account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password is incorrect.')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to your account' }))
    expect(await screen.findByText('Welcome, Demo Player')).toBeVisible()
  })

  it('does not pretend the user is a guest when the server is unavailable', async () => {
    vi.mocked(api.currentUser).mockRejectedValueOnce(new ApiError(503)).mockResolvedValueOnce(account)
    render(<AuthPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t check your account.')
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Welcome, Demo Player')).toBeVisible()
  })

  it('explains a rejected CSRF cookie instead of reporting an expired session', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiError(419, 'csrf_cookie_missing'))
    await guest(); fillLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to your account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your browser did not accept the session cookie.')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Your session has expired')
  })

  it('logs out and returns to the guest form', async () => {
    vi.mocked(api.currentUser).mockResolvedValue(account)
    vi.mocked(api.logout).mockResolvedValue(undefined)
    render(<AuthPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByText('You have been signed out.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign in to your account' })).toBeEnabled()
  })
})
