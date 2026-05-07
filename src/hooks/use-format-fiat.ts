import { SATOSHIS_PER_BTC } from '@/constants/btc'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useSettingsStore } from '@/stores/settings'
import { formatCurrency } from '@/utils/format'

export function useFormatFiat() {
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)
  const { data: btcPrice } = useBitcoinPrice()

  function format(sats: number) {
    if (btcPrice?.currentPrice === undefined) {
      return '—'
    }
    const btcValue = Math.abs(sats) / SATOSHIS_PER_BTC
    return formatCurrency(btcValue * btcPrice.currentPrice, fiatCurrency)
  }

  return format
}
