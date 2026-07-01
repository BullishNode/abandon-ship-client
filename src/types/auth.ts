export interface AuthStatus {
  authRequired: boolean
  authed: boolean
}

export type LoginFailureReason = 'invalid' | 'rate_limited' | 'error'

export type LoginResult = { ok: true } | { ok: false; reason: LoginFailureReason }
