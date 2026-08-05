import { useMutation } from '@tanstack/react-query'
// Static import of the WASM vault: safe only because this hook is reachable
// solely through `__BACKEND__`-guarded lazy imports (the unlock screen and the
// security settings section), which keeps it out of barkd bundles. Do not
// import this hook from shared code.
import {
  clearDeviceVault,
  clearVault,
  openVault,
  saveDeviceVault,
  saveVault,
  unlockWallet
} from '@/lib/backend/wasm'
import { walletApi } from '@/lib/barkd-client'
import { useAuthStore } from '@/stores/auth'

// Reopen the wallet from the encrypted vault with the user's password, then
// mark the session authed so the auth gate reveals the app.
export function useUnlockWithPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const mnemonic = await openVault(password)
      await unlockWallet(mnemonic)
    },
    onSuccess: () => {
      useAuthStore.getState().setStatus({ authRequired: true, authed: true })
    }
  })
}

// Encrypt the currently open wallet's mnemonic under a new password. The
// session seed is always present here because settings is only reachable once
// the wallet is unlocked. The device vault is dropped afterwards — leaving it
// would keep reloads unlocking silently, making the password decorative.
export function useSetWalletPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const mnemonic = await walletApi.mnemonic()
      await saveVault(mnemonic, password)
      await clearDeviceVault()
    }
  })
}

interface ChangePasswordParams {
  current: string
  next: string
}

// Re-encrypt under a new password after verifying the current one by opening
// the existing vault (which throws InvalidPasswordError on a wrong password).
export function useChangeWalletPassword() {
  return useMutation({
    mutationFn: async ({ current, next }: ChangePasswordParams) => {
      const mnemonic = await openVault(current)
      await saveVault(mnemonic, next)
    }
  })
}

// Verify the current password, then return the wallet to passwordless
// operation: the device vault is written BEFORE the password vault is dropped,
// so a failure leaves the password protection intact rather than downgrading
// reloads to mnemonic entry.
export function useRemoveWalletPassword() {
  return useMutation({
    mutationFn: async (current: string) => {
      const mnemonic = await openVault(current)
      await saveDeviceVault(mnemonic)
      clearVault()
    }
  })
}
