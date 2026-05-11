import { DotsThreeVerticalIcon } from '@phosphor-icons/react'
import type { Movement } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/data-table'
import { MovementDetailDialog } from '@/components/movement-detail-dialog'
import { OnchainEntryDetailDialog } from '@/components/onchain-entry-detail-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useOnchainUtxos } from '@/hooks/barkd/use-onchain-utxos'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useSettingsStore } from '@/stores/settings'
import { buildMovementsFeed } from '@/utils/movements-feed'
import type { MovementsFeedRow, OnchainEntry } from '@/utils/movements-feed'
import { formatAbsoluteDateTime, formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [] } = useWalletTransactions()
  const { data: utxos = [] } = useOnchainUtxos()
  const { data: tip } = useBitcoinTip()
  const discreteMode = useSettingsStore((state) => state.discreteMode)
  const hideRefreshMovements = useSettingsStore((state) => state.hideRefreshMovements)
  const setHideRefreshMovements = useSettingsStore((state) => state.setHideRefreshMovements)
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null)
  const [movementOpen, setMovementOpen] = useState(false)
  const [selectedOnchain, setSelectedOnchain] = useState<OnchainEntry | null>(null)
  const [onchainOpen, setOnchainOpen] = useState(false)

  const visibleMovements = hideRefreshMovements
    ? movements.filter((movement) => movement.subsystem.kind !== 'refresh')
    : movements
  const feed = buildMovementsFeed(visibleMovements, utxos, tip?.tipHeight)

  function formatDate(date: Date): string {
    return formatRelativeTime(date, i18n.language)
  }

  function formatDateAbsolute(date: Date): string {
    return formatAbsoluteDateTime(date, i18n.language)
  }

  function handleRowClick(row: MovementsFeedRow) {
    if (row.kind === 'movement') {
      setSelectedMovement(row.movement)
      setMovementOpen(true)
      return
    }
    setSelectedOnchain(row)
    setOnchainOpen(true)
  }

  function handleMovementOpenChange(nextOpen: boolean) {
    setMovementOpen(nextOpen)
    if (!nextOpen) {
      setSelectedMovement(null)
    }
  }

  function handleOnchainOpenChange(nextOpen: boolean) {
    setOnchainOpen(nextOpen)
    if (!nextOpen) {
      setSelectedOnchain(null)
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
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
          <CardTitle>{t('movements.title')}</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={t('movements.options.label')}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <DotsThreeVerticalIcon weight="bold" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <Label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={hideRefreshMovements}
                  onCheckedChange={(checked) => setHideRefreshMovements(checked === true)}
                />
                <span>{t('movements.options.hide_refreshes')}</span>
              </Label>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="px-0 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
          <DataTable columns={columns} data={feed} onRowClick={handleRowClick} />
        </CardContent>
      </Card>
      <MovementDetailDialog
        discreteMode={discreteMode}
        formatDateAbsolute={formatDateAbsolute}
        formatFiat={formatFiat}
        formatSats={formatSats}
        movement={selectedMovement}
        onOpenChange={handleMovementOpenChange}
        open={movementOpen}
      />
      <OnchainEntryDetailDialog
        discreteMode={discreteMode}
        entry={selectedOnchain}
        formatDateAbsolute={formatDateAbsolute}
        formatFiat={formatFiat}
        formatSats={formatSats}
        onOpenChange={handleOnchainOpenChange}
        open={onchainOpen}
      />
    </>
  )
}
