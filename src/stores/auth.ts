import { create } from 'zustand'
import type { AuthStatus } from '@/types/auth'

interface AuthStore {
  authRequired: boolean
  authed: boolean
  deviceUnlockFailed: boolean
  setStatus: (status: AuthStatus) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  authRequired: false,
  authed: true,
  deviceUnlockFailed: false,
  setStatus: (status) => {
    set({ ...status, deviceUnlockFailed: status.deviceUnlockFailed ?? false })
  }
}))
