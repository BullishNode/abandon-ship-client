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
  discreteMode: boolean
  onToggleDiscreteMode: () => void
  className?: string
}

interface BreakdownRow {
  key: string
  label: string
  amount: number
}

export function BalanceCard({
  totals,
  discreteMode,
  onToggleDiscreteMode,
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
      amount: totals.pendingExitSat,
      key: 'pending_exit',
      label: t('dashboard.balance.pending_exit')
    }
  ].filter((row) => row.amount > 0)

  const onlyOffchain =
    totals.onchainSat === 0 &&
    totals.onchainPendingSat === 0 &&
    totals.pendingBoardSat === 0 &&
    totals.pendingInRoundSat === 0 &&
    totals.pendingLightningSendSat === 0 &&
    totals.pendingExitSat === 0
  const showBreakdown = !onlyOffchain && rows.length > 0

  return (
    <Card
      className={cn('h-full min-w-65 max-w-md bg-transparent shadow-none ring-0 pr-4', className)}
      size="sm"
    >
      <CardContent className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <p className="font-bold text-4xl">{formatSats(totals.totalSat)}</p>
            <p className="text-sm font-medium">
              <span aria-hidden="true">≈ </span>
              {formatFiat(totals.totalSat)}
            </p>
          </div>
          <Button
            aria-label={
              discreteMode
                ? t('dashboard.balance.show_amounts')
                : t('dashboard.balance.hide_amounts')
            }
            onClick={onToggleDiscreteMode}
            size="icon"
            variant="ghost"
          >
            {discreteMode ? <EyeSlashIcon /> : <EyeIcon />}
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {showBreakdown ? (
            <m.div
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              key="breakdown"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Separator className="my-3" />
              <div className="flex flex-col text-sm">
                <AnimatePresence initial={false}>
                  {rows.map((row) => (
                    <m.div
                      animate={{ height: 'auto', opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      key={row.key}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <div className="flex items-center justify-between gap-4 py-1 font-medium">
                        <span>{row.label}</span>
                        <span>{formatSats(row.amount)}</span>
                      </div>
                    </m.div>
                  ))}
                </AnimatePresence>
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
