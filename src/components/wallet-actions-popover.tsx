import { ArrowsClockwiseIcon, BoatIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { usePendingRounds } from '@/hooks/barkd/use-pending-rounds'
import { useRefreshAll } from '@/hooks/barkd/use-refresh-all'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useModalsStore } from '@/stores/modals'
import { estimateRefreshAllFeeSat, isRoundInProgress } from '@/utils/refresh'

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
  const { data: pendingRounds } = usePendingRounds()
  const { data: arkInfo } = useArkInfo()
  const { data: tip } = useBitcoinTip()
  const { mutate: refreshAll, isPending: isRefreshing } = useRefreshAll({
    onError: () => {
      toast.error(t('actions_menu.refresh_all.error'))
    },
    onSuccess: () => {
      toast.success(t('actions_menu.refresh_all.started'))
    }
  })
  const minBoardAmountSat = arkInfo?.minBoardAmountSat
  const isRoundActive = isRoundInProgress(pendingRounds)
  const hasNoVtxos = (vtxos?.length ?? 0) === 0
  const isRefreshBusy = isRoundActive || isRefreshing
  const refreshFeeSat = estimateRefreshAllFeeSat(vtxos, tip?.tipHeight, arkInfo?.fees.refresh)

  function handleBoard() {
    setOpen(false)
    openBoard()
  }

  function handleRefreshAll() {
    setOpen(false)
    refreshAll()
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
          disabled={hasNoVtxos || isRefreshBusy}
          icon={<ArrowsClockwiseIcon className={isRefreshBusy ? 'animate-spin' : undefined} />}
          onClick={handleRefreshAll}
          title={
            isRefreshBusy
              ? t('actions_menu.refresh_all.in_progress')
              : t('actions_menu.refresh_all.title')
          }
        />
      </PopoverContent>
    </Popover>
  )
}
