import { create } from 'zustand'
import type { AuthStatus } from '@/types/auth'

interface AuthStore {
  authRequired: boolean
  authed: boolean
  deviceUnlockFailed: boolean
  passwordConfigured: boolean
  // Embedded barkd answered 401. `tokenRejected`: a stored token stopped working.
  tokenRequired: boolean
  tokenRejected: boolean
  requireToken: (rejected: boolean) => void
  setStatus: (status: AuthStatus) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  authRequired: false,
  authed: true,
  deviceUnlockFailed: false,
  passwordConfigured: true,
  requireToken: (rejected) => {
    set({ tokenRejected: rejected, tokenRequired: true })
  },
  setStatus: (status) => {
    set({
      ...status,
      deviceUnlockFailed: status.deviceUnlockFailed ?? false,
      passwordConfigured: status.passwordConfigured ?? true
    })
  },
  tokenRejected: false,
  tokenRequired: false
}))
