import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { WALLET_NAME_MAX_LENGTH } from '@/constants/wallet'

interface WalletInfo {
  name: string
  createdAt: string
  fingerprint: string
}

interface WalletStore {
  wallet: WalletInfo | null
  pendingExitClaimAddress: string | null
  setWallet: (wallet: WalletInfo) => void
  updateWalletName: (name: string) => void
  setPendingExitClaimAddress: (address: string | null) => void
  clearWallet: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      clearWallet: () => {
        set({ pendingExitClaimAddress: null, wallet: null })
      },
      pendingExitClaimAddress: null,
      setPendingExitClaimAddress: (address) => {
        const trimmed = address === null ? null : address.trim()
        set({
          pendingExitClaimAddress: trimmed !== null && trimmed.length > 0 ? trimmed : null
        })
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
