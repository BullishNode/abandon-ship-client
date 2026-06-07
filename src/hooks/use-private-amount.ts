import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { useSettingsStore } from '@/stores/settings'
import { PRIVACY_MASK } from '@/utils/format'

export function usePrivateAmount() {
  const discreetMode = useSettingsStore((state) => state.discreetMode)
  const formatBitcoin = useFormatBitcoin()
  const formatFiat = useFormatFiat()

  return {
    fiat: (sats: number) => (discreetMode ? PRIVACY_MASK : formatFiat(sats)),
    sats: (sats: number) => (discreetMode ? PRIVACY_MASK : formatBitcoin(sats))
  }
}
