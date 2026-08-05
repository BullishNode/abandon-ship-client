import type { Movement } from '@/types/domain/movement'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BARK_WEB_METADATA_KEY } from '@/constants/metadata'
import { historyApi } from '@/lib/barkd-client'
import { invalidateMovements } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import type { BarkWebMovementMetadata } from '@/types/metadata'
import { buildMovementMetadataPatchBody, getMovementMetadata } from '@/utils/metadata'
import type { MovementMetadataPatch } from '@/utils/metadata'

interface UpdateMovementMetadataVars {
  id: number
  patch: MovementMetadataPatch
}

interface UpdateContext {
  previous: Movement[] | undefined
}

function mergePatchOnto(
  existing: BarkWebMovementMetadata | undefined,
  patch: MovementMetadataPatch
): BarkWebMovementMetadata {
  const next: BarkWebMovementMetadata = { ...existing }
  if ('label' in patch) {
    if (patch.label === null || patch.label === undefined) {
      delete next.label
    } else {
      next.label = patch.label
    }
  }
  if ('tags' in patch) {
    if (patch.tags === null || patch.tags === undefined) {
      delete next.tags
    } else {
      next.tags = patch.tags
    }
  }
  if ('contactId' in patch) {
    if (patch.contactId === null || patch.contactId === undefined) {
      delete next.contactId
    } else {
      next.contactId = patch.contactId
    }
  }
  next.updatedAt = new Date().toISOString()
  return next
}

export function useUpdateMovementMetadata() {
  const queryClient = useQueryClient()
  return useMutation<undefined, Error, UpdateMovementMetadataVars, UpdateContext>({
    mutationFn: async ({ id, patch }) => {
      await historyApi.updateMetadata({
        id,
        metadata: buildMovementMetadataPatchBody(patch)
      })
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(walletKeys.transactions(), context.previous)
      }
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: walletKeys.transactions() })
      const previous = queryClient.getQueryData<Movement[]>(walletKeys.transactions())
      if (previous !== undefined) {
        const updated = previous.map((movement) => {
          if (movement.id !== id) {
            return movement
          }
          const nextInner = mergePatchOnto(getMovementMetadata(movement), patch)
          return {
            ...movement,
            metadata: {
              ...movement.metadata,
              [BARK_WEB_METADATA_KEY]: nextInner
            }
          }
        })
        queryClient.setQueryData(walletKeys.transactions(), updated)
      }
      return { previous }
    },
    onSettled: () => {
      void invalidateMovements(queryClient)
    }
  })
}
