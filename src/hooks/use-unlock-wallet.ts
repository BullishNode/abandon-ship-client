import { useMutation } from '@tanstack/react-query'
// Static import of the WASM module: safe only because this hook is reachable
// solely through `__BACKEND__`-guarded lazy imports, which keeps it (and the
// WASM client) out of barkd bundles. Do not import this hook from shared code.
import { clearVault, hasVault, saveDeviceVault, unlockWallet } from '@/lib/backend/wasm'
import { useAuthStore } from '@/stores/auth'

interface UnlockWalletParams {
  mnemonic: string
  // Forgot-password path: drop the password vault the user can no longer open.
  clearPasswordVault?: boolean
}

// WASM-only: reopen the persisted wallet with a re-supplied seed and, on
// success, mark the session authed so the auth gate reveals the app. A wallet
// left passwordless afterwards gets a fresh device vault so future reloads
// unlock silently instead of demanding the phrase again.
export function useUnlockWallet() {
  return useMutation({
    mutationFn: async ({ mnemonic, clearPasswordVault = false }: UnlockWalletParams) => {
      await unlockWallet(mnemonic)
      if (clearPasswordVault) {
        clearVault()
      }
      if (!hasVault()) {
        try {
          await saveDeviceVault(mnemonic)
        } catch {
          // Best-effort: the next reload falls back to this mnemonic gate.
        }
      }
    },
    onSuccess: () => {
      useAuthStore.getState().setStatus({ authRequired: true, authed: true })
    }
  })
}
