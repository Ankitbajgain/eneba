export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string[]>

  constructor(status: number, code = 'request_failed', fields: Record<string, string[]> = {}) {
    super('The service could not complete the request.')
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function request(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', signal?: AbortSignal, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<unknown> {
  if (!path.startsWith('/api/v1/') && path !== '/sanctum/csrf-cookie') throw new Error('Expected a same-origin API path.')

  const response = await fetch(path, {
    credentials: 'same-origin',
    method,
    headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token ?? '' } : {}), ...headers },
    body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
    cache: 'no-store',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    let code = 'request_failed'
    const fields: Record<string, string[]> = {}
    if (typeof payload === 'object' && payload !== null) {
      if ('code' in payload && typeof payload.code === 'string') code = payload.code
      if ('errors' in payload && typeof payload.errors === 'object' && payload.errors !== null) {
        for (const [field, messages] of Object.entries(payload.errors)) {
          if (Array.isArray(messages) && messages.every(message => typeof message === 'string')) fields[field] = messages
        }
      }
    }
    throw new ApiError(response.status, code, fields)
  }
  if (response.status === 204) return undefined
  return response.json()
}

export function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  return request(path, 'GET', signal)
}

export async function mutateJson(path: string, body?: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'POST', headers: Record<string, string> = {}): Promise<unknown> {
  await request('/sanctum/csrf-cookie', 'GET')
  const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))
  if (!cookie) throw new ApiError(419, 'csrf_cookie_missing')
  const token = decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
  // Do not automatically replay writes: a timeout could follow a committed action.
  return request(path, method, undefined, body, token, headers)
}

export function postJson(path: string, body?: unknown): Promise<unknown> { return mutateJson(path, body) }
