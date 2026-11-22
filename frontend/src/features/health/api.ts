import { getJson } from '../../lib/api/client'

export async function checkStoreConnection(signal?: AbortSignal): Promise<void> {
  const response = await getJson('/api/v1/health', signal)
  if (typeof response !== 'object' || response === null || !('status' in response) || response.status !== 'ok') {
    throw new Error('Unexpected readiness response.')
  }
}
