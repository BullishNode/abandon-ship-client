import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { cn } from '@/lib/utils'
import type { BalanceTotals } from '@/utils/balance'

interface BalanceCardProps {
  totals: BalanceTotals
  discreetMode: boolean
  onToggleDiscreetMode: () => void
  className?: string
}

interface BreakdownRow {
  key: string
  label: string
  amount: number
  tooltip?: string
}

export function BalanceCard({
  totals,
  discreetMode,
  onToggleDiscreetMode,
  className
}: BalanceCardProps) {
  const { t } = useTranslation()
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()

  const rows: BreakdownRow[] = [
    {
      amount: totals.offchainSat,
      key: 'offchain',
      label: t('dashboard.balance.offchain')
    },
    {
      amount: totals.needsRefreshSat,
      key: 'renewing',
      label: t('dashboard.balance.renewing'),
      tooltip: t('dashboard.balance.renewing_tooltip')
    },
    {
      amount: totals.onchainSat,
      key: 'onchain',
      label: t('dashboard.balance.onchain')
    },
    {
      amount: totals.onchainPendingSat,
      key: 'onchain_pending',
      label: t('dashboard.balance.onchain_pending')
    },
    {
      amount: totals.exitChangePendingSat,
      key: 'onchain_pending_change',
      label: t('dashboard.balance.onchain_pending_change')
    },
    {
      amount: totals.pendingBoardSat,
      key: 'pending_board',
      label: t('dashboard.balance.pending_board')
    },
    {
      amount: totals.pendingInRoundSat,
      key: 'pending_in_round',
      label: t('dashboard.balance.pending_in_round')
    },
    {
      amount: totals.pendingLightningSendSat,
      key: 'pending_lightning_send',
      label: t('dashboard.balance.pending_lightning_send')
    },
    {
      amount: totals.pendingArkoorSendSat,
      key: 'pending_arkoor_send',
      label: t('dashboard.balance.pending_arkoor_send')
    },
    {
      amount: totals.pendingOffboardSat,
      key: 'pending_offboard',
      label: t('dashboard.balance.pending_offboard')
    },
    {
      amount: totals.pendingExitSat,
      key: 'pending_exit',
      label: t('dashboard.balance.pending_exit')
    }
  ].filter((row) => row.amount > 0)

  const onlyOffchain =
    totals.needsRefreshSat === 0 &&
    totals.pendingArkoorSendSat === 0 &&
    totals.pendingOffboardSat === 0 &&
    totals.onchainSat === 0 &&
    totals.onchainPendingSat === 0 &&
    totals.exitChangePendingSat === 0 &&
    totals.pendingBoardSat === 0 &&
    totals.pendingInRoundSat === 0 &&
    totals.pendingLightningSendSat === 0 &&
    totals.pendingExitSat === 0
  const showBreakdown = !onlyOffchain && rows.length > 0

  return (
    <Card
      className={cn(
        'h-full min-w-65 bg-transparent shadow-none ring-0 lg:max-w-none',
        showBreakdown && 'lg:grid lg:grid-rows-[1fr_auto_1fr]',
        className
      )}
      size="sm"
    >
      <CardContent className="flex items-start justify-between gap-2 pr-4">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-4xl">{formatSats(totals.totalSat)}</p>
          <p className="text-sm font-medium">
            <span aria-hidden="true">≈ </span>
            {formatFiat(totals.totalSat)}
          </p>
        </div>
        <Button
          aria-label={
            discreetMode ? t('dashboard.balance.show_amounts') : t('dashboard.balance.hide_amounts')
          }
          onClick={onToggleDiscreetMode}
          size="icon"
          variant="outline"
        >
          {discreetMode ? <EyeSlashIcon /> : <EyeIcon />}
        </Button>
      </CardContent>
      <AnimatePresence initial={false}>
        {showBreakdown ? (
          <m.div
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            key="separator"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Separator className="mx-4 w-auto" />
          </m.div>
        ) : null}
        {showBreakdown ? (
          <m.div
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            key="breakdown"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <CardContent className="pr-4">
              <div className="flex flex-col text-sm lg:flex-row lg:flex-wrap lg:gap-x-8 lg:gap-y-3">
                <AnimatePresence initial={false}>
                  {rows.map((row) => (
                    <m.div
                      animate={{ height: 'auto', opacity: 1 }}
                      className="overflow-hidden lg:h-auto"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      key={row.key}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <div className="flex flex-row items-center justify-between gap-4 py-1 font-medium lg:flex-col lg:items-start lg:justify-start lg:gap-1 lg:py-0">
                        <span className="text-muted-foreground" title={row.tooltip}>
                          {row.label}
                        </span>
                        <span className="text-base">{formatSats(row.amount)}</span>
                      </div>
                    </m.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </m.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}
