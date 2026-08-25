import { create } from 'zustand'
import type { AuthStatus } from '@/types/auth'

interface AuthStore {
  authRequired: boolean
  authed: boolean
  deviceUnlockFailed: boolean
  passwordConfigured: boolean
  setStatus: (status: AuthStatus) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  authRequired: false,
  authed: true,
  deviceUnlockFailed: false,
  passwordConfigured: true,
  setStatus: (status) => {
    set({
      ...status,
      deviceUnlockFailed: status.deviceUnlockFailed ?? false,
      passwordConfigured: status.passwordConfigured ?? true
    })
  }
}))
