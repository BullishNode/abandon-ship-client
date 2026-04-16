import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/data-table'
import { SATOSHIS_PER_BTC } from '@/constants/btc'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useSettingsStore } from '@/stores/settings'
import { formatCurrency } from '@/utils/format'
import { formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [] } = useWalletTransactions()
  const { data: btcPrice } = useBitcoinPrice()
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)
  const formatBitcoin = useFormatBitcoin()

  function formatFiat(sats: number): string {
    if (btcPrice?.currentPrice === undefined) {
      return '—'
    }
    const btcValue = Math.abs(sats) / SATOSHIS_PER_BTC
    return formatCurrency(btcValue * btcPrice.currentPrice, fiatCurrency)
  }

  function formatDate(date: Date): string {
    return formatRelativeTime(date, i18n.language)
  }

  const columns = getMovementColumns({
    fiatCurrency,
    formatBitcoin,
    formatDate,
    formatFiat,
    t
  })

  return <DataTable columns={columns} data={movements} />
}
