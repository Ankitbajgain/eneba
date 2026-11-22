import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectionStatus } from './ConnectionStatus'

afterEach(() => vi.unstubAllGlobals())

describe('store connection', () => {
  it('shows success only after the readiness API confirms it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })))
    vi.stubGlobal('fetch', fetchMock)
    render(<ConnectionStatus />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(await screen.findByText(/The store connection is ready/)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', expect.objectContaining({ credentials: 'same-origin' }))
  })

  it('handles an outage and lets the user retry successfully', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('private server failure', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))
    vi.stubGlobal('fetch', fetchMock)
    render(<ConnectionStatus />)
    expect(await screen.findByText(/We couldn’t connect/)).toBeVisible()
    expect(screen.queryByText('private server failure')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check connection again' }))
    expect(await screen.findByText(/The store connection is ready/)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed success responses instead of claiming readiness', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'wrong' }))))
    render(<ConnectionStatus />)
    expect(await screen.findByText(/We couldn’t connect/)).toBeVisible()
  })

  it('aborts a pending request when the component unmounts', () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_path, options: RequestInit) => {
      signal = options.signal as AbortSignal
      return new Promise(() => {})
    }))
    const view = render(<ConnectionStatus />)
    expect(signal?.aborted).toBe(false)
    view.unmount()
    expect(signal?.aborted).toBe(true)
  })
})
