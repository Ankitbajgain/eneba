import { getJson, postJson } from '../../lib/api/client'

export type User = { id: number; name: string; email: string }
export type Credentials = { email: string; password: string }
export type Registration = Credentials & { name: string; password_confirmation: string }

function userFromResponse(response: unknown): User {
  if (typeof response === 'object' && response !== null && 'data' in response) {
    const user = response.data
    if (typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'number' && 'name' in user && typeof user.name === 'string' && 'email' in user && typeof user.email === 'string') {
      return { id: user.id, name: user.name, email: user.email }
    }
  }
  throw new Error('Unexpected account response.')
}

export async function currentUser(signal?: AbortSignal): Promise<User> {
  return userFromResponse(await getJson('/api/v1/auth/me', signal))
}

export async function login(input: Credentials): Promise<User> {
  return userFromResponse(await postJson('/api/v1/auth/login', input))
}

export async function register(input: Registration): Promise<User> {
  return userFromResponse(await postJson('/api/v1/auth/register', input))
}

export async function logout(): Promise<void> {
  await postJson('/api/v1/auth/logout')
}
