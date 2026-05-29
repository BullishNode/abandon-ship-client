import type { Movement } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { historyApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'
import { useMetadataStore } from '@/stores/metadata'
import { useWalletStore } from '@/stores/wallet'
import {
  applyBindingPromotions,
  buildMovementMetadataPatchBody,
  computeBindingPromotions
} from '@/utils/metadata'

async function promoteBindings(movements: Movement[]): Promise<Movement[]> {
  const fingerprint = useWalletStore.getState().wallet?.fingerprint
  if (fingerprint === undefined) {
    return movements
  }
  const bindings = useMetadataStore.getState().bindings[fingerprint] ?? []
  const promotions = computeBindingPromotions(movements, bindings)
  if (promotions.length === 0) {
    return movements
  }
  const settled = await Promise.allSettled(
    promotions.map(async (promotion) => {
      await historyApi.updateMetadata({
        body: buildMovementMetadataPatchBody({
          contactId: promotion.metadata.contactId,
          label: promotion.metadata.label,
          tags: promotion.metadata.tags
        }),
        id: promotion.movementId
      })
    })
  )
  const successful = promotions.filter((_, index) => settled[index].status === 'fulfilled')
  const { removeBinding } = useMetadataStore.getState()
  for (const promotion of successful) {
    removeBinding(promotion.bindingId)
  }
  return applyBindingPromotions(movements, successful)
}

export function useWalletTransactions(
  options?: Omit<UseQueryOptions<Movement[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const movements = await historyApi.list()
      return await promoteBindings(movements)
    },
    queryKey: walletKeys.transactions(),
    ...options
  })
}
