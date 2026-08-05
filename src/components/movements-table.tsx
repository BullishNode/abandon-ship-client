import {
  CaretDownIcon,
  FunnelSimpleIcon,
  QrCodeIcon,
  ScanIcon,
  TrayIcon
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { DataTable } from '@/components/data-table'
import { MOVEMENTS_PAGE_SIZE } from '@/constants/movements'
import { MovementDetailDialog } from '@/components/movement-detail-dialog'
import { MovementsTableSkeleton } from '@/components/movements-table-skeleton'
import { OnchainEntryDetailDialog } from '@/components/onchain-entry-detail-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useOnchainTransactions } from '@/hooks/barkd/use-onchain-transactions'
import { useOnchainUtxos } from '@/hooks/barkd/use-onchain-utxos'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { config } from '@/config/runtime'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useOnchainFirstSeen } from '@/stores/metadata'
import { usePendingOffboards } from '@/stores/pending-offboards'
import { canUseCamera } from '@/utils/camera'
import { useModalsStore } from '@/stores/modals'
import { useSettingsStore } from '@/stores/settings'
import type { MovementsTab } from '@/types/movements'
import { buildMovementsFeed, filterFeedByTab } from '@/utils/movements-feed'
import type { MovementsFeedRow, OnchainTxEntry } from '@/utils/movements-feed'
import { formatAbsoluteDateTime, formatRelativeTime } from '@/utils/relative-time'
import { getMovementColumns } from './movements-columns'

const MOVEMENT_TABS: MovementsTab[] = ['all', 'ark', 'lightning', 'onchain']

function toMovementsTab(value: string): MovementsTab {
  if (value === 'ark' || value === 'lightning' || value === 'onchain') {
    return value
  }
  return 'all'
}

export function MovementsTable() {
  const { t, i18n } = useTranslation()
  const { data: movements = [], isPending: movementsPending } = useWalletTransactions()
  const { data: utxos = [], isPending: utxosPending } = useOnchainUtxos()
  const { data: transactions = [], isPending: transactionsPending } = useOnchainTransactions()
  const { data: tip } = useBitcoinTip()
  const isFeedLoading = movementsPending || utxosPending || transactionsPending
  const firstSeenAt = useOnchainFirstSeen()
  const pendingOffboards = usePendingOffboards()
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
  const scanSupported = canUseCamera()
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)
  const [movementOpen, setMovementOpen] = useState(false)
  const [selectedOnchain, setSelectedOnchain] = useState<OnchainTxEntry | null>(null)
  const [onchainOpen, setOnchainOpen] = useState(false)
  const [tab, setTab] = useState<MovementsTab>('all')

  const feed = buildMovementsFeed(movements, {
    firstSeenAt,
    hideExitFee: hideExitFeeMovements,
    hideRefresh: hideRefreshMovements,
    network: config.network,
    pendingOffboards,
    tipHeight: tip,
    transactions,
    utxos
  })
  const visibleFeed = filterFeedByTab(feed, tab)
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

  if (isFeedLoading) {
    return <MovementsTableSkeleton />
  }

  const feedContent =
    visibleFeed.length === 0 ? (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TrayIcon />
          </EmptyMedia>
          <EmptyTitle>{t('movements.empty')}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2 mt-2">
            {scanSupported && (
              <Button onClick={() => openSend('scan')} variant="outline">
                <ScanIcon />
                {t('actions.scan')}
              </Button>
            )}
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
        data={visibleFeed}
        key={tab}
        onRowClick={handleRowClick}
        pageSize={MOVEMENTS_PAGE_SIZE}
      />
    )

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between gap-2">
          <Tabs onValueChange={(value) => setTab(toMovementsTab(value))} value={tab}>
            <Label className="sr-only" htmlFor="movements-tab-select">
              {t('movements.tabs.view')}
            </Label>
            <Select onValueChange={(value) => setTab(toMovementsTab(value))} value={tab}>
              <SelectTrigger className="flex w-40 sm:hidden" id="movements-tab-select" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TABS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`movements.tabs.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TabsList className="hidden sm:inline-flex">
              {MOVEMENT_TABS.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {t(`movements.tabs.${value}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" type="button" variant="outline">
                <FunnelSimpleIcon />
                <span className="hidden sm:inline">{t('movements.filters.label')}</span>
                <CaretDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuCheckboxItem
                checked={hideRefreshMovements}
                onCheckedChange={(checked) => setHideRefreshMovements(checked)}
                onSelect={(event) => event.preventDefault()}
              >
                {t('movements.options.hide_refreshes')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={hideExitFeeMovements}
                onCheckedChange={(checked) => setHideExitFeeMovements(checked)}
                onSelect={(event) => event.preventDefault()}
              >
                {t('movements.options.hide_exit_fees')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Card className="py-0">
          <CardContent className="px-0 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
            {feedContent}
          </CardContent>
        </Card>
      </div>
      <MovementDetailDialog
        discreetMode={discreetMode}
        formatDateAbsolute={formatDateAbsolute}
        formatFiat={formatFiat}
        formatSats={formatSats}
        movement={selectedMovement}
        onOpenChange={handleMovementOpenChange}
        open={movementOpen}
        transactions={transactions}
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
