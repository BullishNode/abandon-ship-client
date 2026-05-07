import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { useSettingsStore } from '@/stores/settings'
import { PRIVACY_MASK } from '@/utils/format'

export function usePrivateAmount() {
  const discreteMode = useSettingsStore((state) => state.discreteMode)
  const formatBitcoin = useFormatBitcoin()
  const formatFiat = useFormatFiat()

  return {
    fiat: (sats: number) => (discreteMode ? PRIVACY_MASK : formatFiat(sats)),
    sats: (sats: number) => (discreteMode ? PRIVACY_MASK : formatBitcoin(sats))
  }
}
