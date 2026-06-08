import { DotsThreeVerticalIcon, QrCodeIcon, ScanIcon, TrayIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { DataTable } from '@/components/data-table'
import { MOVEMENTS_PAGE_SIZE } from '@/constants/movements'
import { MovementDetailDialog } from '@/components/movement-detail-dialog'
import { MovementsTableSkeleton } from '@/components/movements-table-skeleton'
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
import { useOnchainFirstSeen } from '@/stores/metadata'
import { useModalsStore } from '@/stores/modals'
import { useSettingsStore } from '@/stores/settings'
import { buildMovementsFeed } from '@/utils/movements-feed'
import type { MovementsFeedRow, OnchainTxEntry } from '@/utils/movements-feed'
import { formatAbsoluteDateTime, formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [], isPending: movementsPending } = useWalletTransactions()
  const { data: utxos = [], isPending: utxosPending } = useOnchainUtxos()
  const { data: transactions = [], isPending: transactionsPending } = useOnchainTransactions()
  const { data: tip } = useBitcoinTip()
  const isFeedLoading = movementsPending || utxosPending || transactionsPending
  const firstSeenAt = useOnchainFirstSeen()
  const [
    discreetMode,
    hideRefreshMovements,
    setHideRefreshMovements,
    hideExitFeeMovements,
    setHideExitFeeMovements
  ] = useSettingsStore(
    useShallow((state) => [
      state.discreetMode,
      state.hideRefreshMovements,
      state.setHideRefreshMovements,
      state.hideExitFeeMovements,
      state.setHideExitFeeMovements
    ])
  )
  const [openSend, openReceive] = useModalsStore(
    useShallow((state) => [state.openSend, state.openReceive])
  )
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)
  const [movementOpen, setMovementOpen] = useState(false)
  const [selectedOnchain, setSelectedOnchain] = useState<OnchainTxEntry | null>(null)
  const [onchainOpen, setOnchainOpen] = useState(false)

  const feed = buildMovementsFeed(movements, {
    firstSeenAt,
    hideExitFee: hideExitFeeMovements,
    hideRefresh: hideRefreshMovements,
    network: config.network,
    tipHeight: tip?.tipHeight,
    transactions,
    utxos
  })
  const selectedMovement =
    selectedMovementId === null
      ? null
      : (movements.find((movement) => movement.id === selectedMovementId) ?? null)

  function formatDate(date: Date): string {
    return formatRelativeTime(date, i18n.language)
  }

  function formatDateAbsolute(date: Date): string {
    return formatAbsoluteDateTime(date, i18n.language)
  }

  function handleRowClick(row: MovementsFeedRow) {
    if (row.kind === 'movement') {
      setSelectedMovementId(row.movement.id)
      setMovementOpen(true)
      return
    }
    setSelectedOnchain(row)
    setOnchainOpen(true)
  }

  function handleMovementOpenChange(nextOpen: boolean) {
    setMovementOpen(nextOpen)
    if (!nextOpen) {
      setSelectedMovementId(null)
    }
  }

  function handleOnchainOpenChange(nextOpen: boolean) {
    setOnchainOpen(nextOpen)
    if (!nextOpen) {
      setSelectedOnchain(null)
    }
  }

  const columns = getMovementColumns({
    discreetMode,
    formatDate,
    formatFiat,
    formatSats,
    t
  })

  let feedContent: React.ReactNode
  if (isFeedLoading) {
    feedContent = <MovementsTableSkeleton />
  } else if (feed.length === 0) {
    feedContent = (
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
    )
  } else {
    feedContent = (
      <DataTable
        columns={columns}
        data={feed}
        onRowClick={handleRowClick}
        pageSize={MOVEMENTS_PAGE_SIZE}
      />
    )
  }

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
            <PopoverContent align="end" className="w-auto p-2">
              <Label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={hideRefreshMovements}
                  onCheckedChange={(checked) => setHideRefreshMovements(checked === true)}
                />
                <span className="whitespace-nowrap">{t('movements.options.hide_refreshes')}</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={hideExitFeeMovements}
                  onCheckedChange={(checked) => setHideExitFeeMovements(checked === true)}
                />
                <span className="whitespace-nowrap">{t('movements.options.hide_exit_fees')}</span>
              </Label>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="px-0 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
          {feedContent}
        </CardContent>
      </Card>
      <MovementDetailDialog
        discreetMode={discreetMode}
        formatDateAbsolute={formatDateAbsolute}
        formatFiat={formatFiat}
        formatSats={formatSats}
        movement={selectedMovement}
        onOpenChange={handleMovementOpenChange}
        open={movementOpen}
      />
      <OnchainEntryDetailDialog
        discreetMode={discreetMode}
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
