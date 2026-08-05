import type { Movement } from '@/types/domain/movement'
import { useReceivedPayment } from '@/hooks/barkd/use-received-payment'
import { useRefreshVtxos } from '@/hooks/barkd/use-refresh-vtxos'
import { useSettingsStore } from '@/stores/settings'

export function useRefreshOnReceive(): void {
  const refreshOnReceive = useSettingsStore((state) => state.refreshOnReceive)
  const { mutate: refreshVtxos } = useRefreshVtxos()

  useReceivedPayment(
    (movement: Movement) => {
      if (movement.outputVtxos.length === 0) {
        return
      }
      refreshVtxos({ vtxos: movement.outputVtxos })
    },
    { enabled: refreshOnReceive }
  )
}
