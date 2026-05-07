import { CurrencyBtcIcon } from '@phosphor-icons/react'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useSettingsStore } from '@/stores/settings'
import { formatCurrency } from '@/utils/format'
import { StatCard } from './stat-card'

export function BitcoinPriceCard() {
  const { data: btcPrice, isLoading } = useBitcoinPrice()
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)

  const display =
    btcPrice?.currentPrice === undefined ? '—' : formatCurrency(btcPrice.currentPrice, fiatCurrency)

  return (
    <StatCard icon={CurrencyBtcIcon} title="Bitcoin price">
      {isLoading ? '—' : display}
    </StatCard>
  )
}
