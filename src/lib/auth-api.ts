import { z } from 'zod'
import type { AuthStatus, LoginResult } from '@/types/auth'

const authStatusSchema = z.object({
  authRequired: z.boolean(),
  authed: z.boolean()
})

const OPEN_STATUS: AuthStatus = { authRequired: false, authed: true }

const RATE_LIMITED = 429
const UNAUTHORIZED = 401

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const response = await fetch('/api/auth/status')
    if (!response.ok) {
      return OPEN_STATUS
    }
    return authStatusSchema.parse(await response.json())
  } catch {
    return OPEN_STATUS
  }
}

export async function login(password: string): Promise<LoginResult> {
  try {
    const response = await fetch('/api/login', {
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    })
    if (response.ok) {
      return { ok: true }
    }
    if (response.status === RATE_LIMITED) {
      return { ok: false, reason: 'rate_limited' }
    }
    if (response.status === UNAUTHORIZED) {
      return { ok: false, reason: 'invalid' }
    }
    return { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' })
}
