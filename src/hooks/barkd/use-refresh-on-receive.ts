import { usePendingRounds } from '@/hooks/barkd/use-pending-rounds'
import { useRefreshCounterparty } from '@/hooks/barkd/use-refresh-counterparty'
import { useReceivedPayment } from '@/hooks/barkd/use-received-payment'
import { useSettingsStore } from '@/stores/settings'
import { isRoundInProgress } from '@/utils/refresh'

export function useRefreshOnReceive(): void {
  const refreshOnReceive = useSettingsStore((state) => state.refreshOnReceive)
  const { data: pendingRounds } = usePendingRounds()
  const { mutate: refreshCounterparty } = useRefreshCounterparty()

  useReceivedPayment(
    () => {
      if (isRoundInProgress(pendingRounds)) {
        return
      }
      refreshCounterparty()
    },
    { enabled: refreshOnReceive }
  )
}
