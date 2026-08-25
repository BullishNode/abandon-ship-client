import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eraseLockedWallet } from '@/lib/backend/wasm'
import { resetWalletQueriesAfterDelete } from '@/lib/query-invalidations'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

// WASM-only escape hatch at the locked gate: wipe the wallet the user can no
// longer unlock so onboarding can start over with a different seed. Clearing
// the auth requirement last hands control back to the router, which sees no
// wallet and lands on the welcome page.
export function useEraseWallet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: eraseLockedWallet,
    onSuccess: async () => {
      await resetWalletQueriesAfterDelete(queryClient)
      useWalletStore.getState().clearWallet()
      useAuthStore.getState().setStatus({ authRequired: false, authed: true })
    }
  })
}
