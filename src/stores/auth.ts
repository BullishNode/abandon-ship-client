import { create } from 'zustand'
import type { AuthStatus } from '@/types/auth'

interface AuthStore {
  authRequired: boolean
  authed: boolean
  setStatus: (status: AuthStatus) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  authRequired: false,
  authed: true,
  setStatus: (status) => {
    set(status)
  }
}))
