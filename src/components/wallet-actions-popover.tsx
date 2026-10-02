import { ArrowsClockwiseIcon, BoatIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useRefreshingVtxos } from '@/hooks/barkd/use-refreshing-vtxos'
import { useTrackedRefresh } from '@/hooks/barkd/use-tracked-refresh'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useModalsStore } from '@/stores/modals'
import { getRefusedVtxoIds, useRefreshFailuresStore } from '@/stores/refresh-failures'
import { estimateRefreshAllFeeSat, getRefreshableVtxos, mapRefreshPhases } from '@/utils/refresh'

interface WalletActionRowProps {
  description: string
  detail?: string
  disabled?: boolean
  icon: ReactNode
  onClick: () => void
  title: string
}

function WalletActionRow({
  description,
  detail,
  disabled,
  icon,
  onClick,
  title
}: WalletActionRowProps) {
  return (
    <button
      className="flex w-full cursor-pointer items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
        {detail !== undefined && <span className="text-muted-foreground text-xs">{detail}</span>}
      </span>
    </button>
  )
}

export function WalletActionsPopover() {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const [open, setOpen] = useState(false)
  const openBoard = useModalsStore((state) => state.openBoard)
  const { data: vtxos } = useVtxos()
  const { data: refreshingVtxos = [] } = useRefreshingVtxos()
  const { data: arkInfo } = useArkInfo()
  const { data: tip } = useBitcoinTip()
  const refusedAtHeight = useRefreshFailuresStore((state) => state.refusedAtHeight)
  const { refresh, isPending: isRefreshing } = useTrackedRefresh({
    done: t('actions_menu.refresh_all.done'),
    failed: t('actions_menu.refresh_all.error'),
    nothing: t('actions_menu.refresh_all.nothing'),
    stillPending: t('vtxos.refresh.still_pending'),
    waiting: t('actions_menu.refresh_all.started')
  })
  const minBoardAmountSat = arkInfo?.minBoardAmountSats
  // Coins the server refused are left out: one of them fails the whole batch.
  const excludedIds = new Set([
    ...mapRefreshPhases(refreshingVtxos).keys(),
    ...getRefusedVtxoIds(refusedAtHeight, tip)
  ])
  const refreshableIds = getRefreshableVtxos(vtxos ?? [], excludedIds).map((vtxo) => vtxo.id)
  const hasNoRefreshableVtxos = refreshableIds.length === 0
  const refreshFeeSat = estimateRefreshAllFeeSat(vtxos, tip, arkInfo?.fees.refresh, excludedIds)

  function handleBoard() {
    setOpen(false)
    openBoard()
  }

  function handleRefreshAll() {
    setOpen(false)
    refresh(refreshableIds)
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button aria-label={t('actions.more')} size="icon" variant="outline">
          <DotsThreeIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-1 p-2">
        <WalletActionRow
          description={t('actions_menu.board.description')}
          detail={
            minBoardAmountSat === undefined
              ? undefined
              : t('actions_menu.board.minimum', { amount: formatBitcoin(minBoardAmountSat) })
          }
          icon={<BoatIcon />}
          onClick={handleBoard}
          title={t('actions_menu.board.title')}
        />
        <WalletActionRow
          description={t('actions_menu.refresh_all.description')}
          detail={
            refreshFeeSat === undefined
              ? undefined
              : t('actions_menu.refresh_all.fee_estimate', { fee: formatBitcoin(refreshFeeSat) })
          }
          disabled={hasNoRefreshableVtxos || isRefreshing}
          icon={<ArrowsClockwiseIcon className={isRefreshing ? 'animate-spin' : undefined} />}
          onClick={handleRefreshAll}
          title={
            isRefreshing
              ? t('actions_menu.refresh_all.in_progress')
              : t('actions_menu.refresh_all.title')
          }
        />
      </PopoverContent>
    </Popover>
  )
}
