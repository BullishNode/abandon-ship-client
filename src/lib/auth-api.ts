import { z } from 'zod'
import type { AuthStatus, LoginResult, SetupPasswordResult } from '@/types/auth'

// An older api container omits `configured`, and an absent flag has to read as
// "configured" so the UI shows the login form rather than offering to claim a
// protected instance.
const authStatusSchema = z
  .object({
    authRequired: z.boolean(),
    authed: z.boolean(),
    configured: z.boolean().default(true)
  })
  .transform(({ configured, ...status }) => ({ ...status, passwordConfigured: configured }))

const OPEN_STATUS: AuthStatus = { authRequired: false, authed: true }

const RATE_LIMITED = 429
const UNAUTHORIZED = 401
const BAD_REQUEST = 400
const CONFLICT = 409

// Mirrors `MIN_PASSWORD_LENGTH` in api/src/auth.ts.
export const MIN_UI_PASSWORD_LENGTH = 8

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

export async function setupPassword(password: string): Promise<SetupPasswordResult> {
  try {
    const response = await fetch('/api/auth/setup', {
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'bark' },
      method: 'POST'
    })
    if (response.ok) {
      return { ok: true }
    }
    if (response.status === RATE_LIMITED) {
      return { ok: false, reason: 'rate_limited' }
    }
    if (response.status === CONFLICT) {
      return { ok: false, reason: 'already_configured' }
    }
    if (response.status === BAD_REQUEST) {
      return { ok: false, reason: 'weak' }
    }
    return { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' })
}
