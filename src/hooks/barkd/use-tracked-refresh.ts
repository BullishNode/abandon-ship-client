import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRefreshVtxos } from '@/hooks/barkd/use-refresh-vtxos'
import { backendErrorMessage } from '@/lib/error-message'
import { bitcoinKeys } from '@/lib/query-keys'
import { invalidateRefreshState } from '@/lib/query-invalidations'
import { waitForRoundResult } from '@/lib/round-result'
import { useRefreshFailuresStore } from '@/stores/refresh-failures'
import { parseUnusableInputIds } from '@/utils/refresh'

export interface TrackedRefreshMessages {
  waiting: string
  done: string
  failed: string
  nothing: string
  stillPending: string
}

// A manual refresh: registers the participation, then keeps one toast up until
// the round accepted or refused the coins. Refused coins are remembered so the
// next batch leaves them out.
export function useTrackedRefresh(messages: TrackedRefreshMessages, onStarted?: () => void) {
  const queryClient = useQueryClient()
  const addRefusedVtxoIds = useRefreshFailuresStore((state) => state.addRefusedVtxoIds)

  async function reportFailure(error: string | undefined, toastId?: string | number) {
    addRefusedVtxoIds(
      parseUnusableInputIds(error),
      queryClient.getQueryData<number>(bitcoinKeys.tip())
    )
    toast.error(messages.failed, { description: error, id: toastId })
    await invalidateRefreshState(queryClient)
  }

  const mutation = useRefreshVtxos({
    onError: async (error) => {
      await reportFailure(await backendErrorMessage(error))
    },
    onSuccess: async (round, { vtxos }) => {
      // A null round means the backend registered no participation.
      if (round === null) {
        toast.info(messages.nothing)
        return
      }
      onStarted?.()
      const toastId = toast.loading(messages.waiting)
      const result = await waitForRoundResult(round, vtxos)
      if (result.type === 'failed') {
        await reportFailure(result.error, toastId)
        return
      }
      if (result.type === 'still-pending') {
        toast.info(messages.stillPending, { id: toastId })
        return
      }
      toast.success(messages.done, { id: toastId })
      await invalidateRefreshState(queryClient)
    }
  })

  return {
    isPending: mutation.isPending,
    refresh: (vtxos: string[]) => {
      mutation.mutate({ vtxos })
    }
  }
}
