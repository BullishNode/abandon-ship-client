import type { Movement } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/data-table'
import { MovementDetailDialog } from '@/components/movement-detail-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useSettingsStore } from '@/stores/settings'
import { formatAbsoluteDateTime, formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [] } = useWalletTransactions()
  const discreteMode = useSettingsStore((state) => state.discreteMode)
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const [selected, setSelected] = useState<Movement | null>(null)
  const [open, setOpen] = useState(false)

  function formatDate(date: Date): string {
    return formatRelativeTime(date, i18n.language)
  }

  function formatDateAbsolute(date: Date): string {
    return formatAbsoluteDateTime(date, i18n.language)
  }

  function handleRowClick(movement: Movement) {
    setSelected(movement)
    setOpen(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSelected(null)
    }
  }

  const columns = getMovementColumns({
    discreteMode,
    formatDate,
    formatFiat,
    formatSats,
    t
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('movements.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
          <DataTable columns={columns} data={movements} onRowClick={handleRowClick} />
        </CardContent>
      </Card>
      <MovementDetailDialog
        discreteMode={discreteMode}
        formatDateAbsolute={formatDateAbsolute}
        formatFiat={formatFiat}
        formatSats={formatSats}
        movement={selected}
        onOpenChange={handleOpenChange}
        open={open}
      />
    </>
  )
}
