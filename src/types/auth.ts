export interface AuthStatus {
  authRequired: boolean
  authed: boolean
  deviceUnlockFailed?: boolean
  // barkd only: false while `UI_AUTH=true` and no password file exists yet.
  // Undefined in WASM builds, where the password is client-side and optional.
  passwordConfigured?: boolean
}

export type LoginFailureReason = 'invalid' | 'rate_limited' | 'error'

export type LoginResult = { ok: true } | { ok: false; reason: LoginFailureReason }

export type SetupPasswordFailureReason = 'weak' | 'already_configured' | 'rate_limited' | 'error'

export type SetupPasswordResult = { ok: true } | { ok: false; reason: SetupPasswordFailureReason }
