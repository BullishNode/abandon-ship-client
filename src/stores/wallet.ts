import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface WalletInfo {
  name: string
  createdAt: string
}

interface WalletStore {
  wallet: WalletInfo | null
  setWallet: (wallet: WalletInfo) => void
  clearWallet: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      wallet: null,
      setWallet: (wallet) => set({ wallet }),
      clearWallet: () => set({ wallet: null })
    }),
    {
      name: 'bark-web-wallet-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
