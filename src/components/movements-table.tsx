import { DotsThreeVerticalIcon, QrCodeIcon, ScanIcon, TrayIcon } from '@phosphor-icons/react'
import type { Movement } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { DataTable } from '@/components/data-table'
import { MOVEMENTS_PAGE_SIZE } from '@/constants/movements'
import { MovementDetailDialog } from '@/components/movement-detail-dialog'
import { OnchainEntryDetailDialog } from '@/components/onchain-entry-detail-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useOnchainTransactions } from '@/hooks/barkd/use-onchain-transactions'
import { useOnchainUtxos } from '@/hooks/barkd/use-onchain-utxos'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { config } from '@/config/barkd'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useModalsStore } from '@/stores/modals'
import { useSettingsStore } from '@/stores/settings'
import { buildMovementsFeed } from '@/utils/movements-feed'
import type { MovementsFeedRow, OnchainTxEntry } from '@/utils/movements-feed'
import { formatAbsoluteDateTime, formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [] } = useWalletTransactions()
  const { data: utxos = [] } = useOnchainUtxos()
  const { data: transactions = [] } = useOnchainTransactions()
  const { data: tip } = useBitcoinTip()
  const [discreteMode, hideRefreshMovements, setHideRefreshMovements] = useSettingsStore(
    useShallow((state) => [
      state.discreteMode,
      state.hideRefreshMovements,
      state.setHideRefreshMovements
    ])
  )
  const [openSend, openReceive] = useModalsStore(
    useShallow((state) => [state.openSend, state.openReceive])
  )
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null)
  const [movementOpen, setMovementOpen] = useState(false)
  const [selectedOnchain, setSelectedOnchain] = useState<OnchainTxEntry | null>(null)
  const [onchainOpen, setOnchainOpen] = useState(false)

  const visibleMovements = hideRefreshMovements
    ? movements.filter((movement) => movement.subsystem.kind !== 'refresh')
    : movements
  const feed = buildMovementsFeed(visibleMovements, {
    network: config.network,
    tipHeight: tip?.tipHeight,
    transactions,
    utxos
  })

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
          {feed.length === 0 ? (
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TrayIcon />
                </EmptyMedia>
                <EmptyTitle>{t('movements.empty')}</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex gap-2 mt-2">
                  <Button onClick={() => openSend('scan')} variant="outline">
                    <ScanIcon />
                    {t('actions.scan')}
                  </Button>
                  <Button onClick={openReceive}>
                    <QrCodeIcon />
                    {t('actions.receive')}
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          ) : (
            <DataTable
              columns={columns}
              data={feed}
              onRowClick={handleRowClick}
              pageSize={MOVEMENTS_PAGE_SIZE}
            />
          )}
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
