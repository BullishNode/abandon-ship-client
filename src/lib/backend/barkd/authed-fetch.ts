import { currentAuthToken, rejectStoredAuthToken } from '@/lib/backend/barkd/auth-token'
import { useAuthStore } from '@/stores/auth'

const UNAUTHORIZED = 401

export function withAuthToken(init: RequestInit = {}): RequestInit {
  const token = currentAuthToken()
  if (token === null) {
    return init
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

// A 401 that is not the UI-password session gate can only be barkd rejecting
// our bearer.
export function handleUnauthorized(response: Response): void {
  if (response.status !== UNAUTHORIZED) {
    return
  }
  const { authRequired, setStatus } = useAuthStore.getState()
  if (authRequired) {
    setStatus({ authRequired: true, authed: false })
    return
  }
  rejectStoredAuthToken()
}

export async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, withAuthToken({ credentials: 'same-origin', ...init }))
  handleUnauthorized(response)
  return response
}
