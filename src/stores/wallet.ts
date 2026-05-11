import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { WALLET_NAME_MAX_LENGTH } from '@/constants/wallet'

interface WalletInfo {
  name: string
  createdAt: string
}

interface WalletStore {
  wallet: WalletInfo | null
  setWallet: (wallet: WalletInfo) => void
  updateWalletName: (name: string) => void
  clearWallet: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      clearWallet: () => {
        set({ wallet: null })
      },
      setWallet: (wallet) => {
        set({ wallet })
      },
      updateWalletName: (name) => {
        const trimmed = name.trim().slice(0, WALLET_NAME_MAX_LENGTH)
        if (trimmed.length === 0) {
          return
        }
        set((state) => (state.wallet ? { wallet: { ...state.wallet, name: trimmed } } : state))
      },
      wallet: null
    }),
    {
      name: 'bark-web-wallet-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
