import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, postJson } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
})

describe('session REST writes', () => {
  it('bootstraps CSRF and sends the URL-decoded cookie header with credentials', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(async () => {
      document.cookie = 'XSRF-TOKEN=encoded%2Btoken%3D; Path=/'
      return new Response(null, { status: 204 })
    }).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await postJson('/api/v1/auth/logout')
    expect(fetchMock.mock.calls[0][0]).toBe('/sanctum/csrf-cookie')
    expect(fetchMock.mock.calls[1]).toEqual(['/api/v1/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'same-origin', headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'encoded+token=' }) })])
  })

  it('does not send a mutation when CSRF cookie initialization fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(postJson('/api/v1/auth/login', {})).rejects.toMatchObject({ status: 419, code: 'csrf_cookie_missing' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserves safe validation fields and never automatically replays a failed write', async () => {
    document.cookie = 'XSRF-TOKEN=token; Path=/'
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'validation_failed', errors: { email: ['Invalid email.'] } }), { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = postJson('/api/v1/auth/register', {})
    await expect(result).rejects.toBeInstanceOf(ApiError)
    await expect(result).rejects.toMatchObject({ fields: { email: ['Invalid email.'] } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
