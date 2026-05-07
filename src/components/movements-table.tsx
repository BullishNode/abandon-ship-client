import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/data-table'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useSettingsStore } from '@/stores/settings'
import { formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [] } = useWalletTransactions()
  const discreteMode = useSettingsStore((state) => state.discreteMode)
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()

  function formatDate(date: Date): string {
    return formatRelativeTime(date, i18n.language)
  }

  const columns = getMovementColumns({
    discreteMode,
    formatDate,
    formatFiat,
    formatSats,
    t
  })

  return <DataTable columns={columns} data={movements} />
}
