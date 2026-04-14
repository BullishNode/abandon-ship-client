import { SATOSHIS_PER_BTC } from '@/constants/btc'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useSettingsStore } from '@/stores/settings'
import { formatCurrency } from '@/utils/format'

export default function TransactionsPage() {
  const { data: balance } = useWalletBalance()
  const { data: btcPrice } = useBitcoinPrice()
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)
  const formatBitcoin = useFormatBitcoin()

  const balanceSats = balance?.spendableSat ?? 0
  const balanceBtc = balanceSats / SATOSHIS_PER_BTC
  const fiatValue =
    btcPrice?.currentPrice === undefined
      ? '—'
      : formatCurrency(balanceBtc * btcPrice.currentPrice, fiatCurrency)

  return (
    <div>
      <p className="font-bold text-4xl">{formatBitcoin(balanceSats)}</p>
      <p className="text-muted-foreground">{fiatValue}</p>
    </div>
  )
}
