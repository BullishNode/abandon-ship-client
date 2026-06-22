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
  exitClaimAddresses: Record<string, string>
  isEmergencyExitAllInProgress: boolean
  setWallet: (wallet: WalletInfo) => void
  updateWalletName: (name: string) => void
  setExitClaimAddresses: (vtxoIds: string[], address: string) => void
  clearExitClaimAddresses: (vtxoIds: string[]) => void
  setIsEmergencyExitAllInProgress: (value: boolean) => void
  clearWallet: () => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      clearExitClaimAddresses: (vtxoIds) => {
        const removed = new Set(vtxoIds)
        set((state) => ({
          exitClaimAddresses: Object.fromEntries(
            Object.entries(state.exitClaimAddresses).filter(([id]) => !removed.has(id))
          )
        }))
      },
      clearWallet: () => {
        set({ exitClaimAddresses: {}, isEmergencyExitAllInProgress: false, wallet: null })
      },
      exitClaimAddresses: {},
      isEmergencyExitAllInProgress: false,
      setExitClaimAddresses: (vtxoIds, address) => {
        const trimmed = address.trim()
        const target = new Set(vtxoIds)
        set((state) => {
          const kept = Object.entries(state.exitClaimAddresses).filter(([id]) => !target.has(id))
          const added = trimmed.length > 0 ? vtxoIds.map((id) => [id, trimmed] as const) : []
          return { exitClaimAddresses: Object.fromEntries([...kept, ...added]) }
        })
      },
      setIsEmergencyExitAllInProgress: (value) => {
        set({ isEmergencyExitAllInProgress: value })
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
