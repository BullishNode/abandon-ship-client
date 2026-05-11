import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { BalanceChart } from '@/components/balance-chart'
import { BitcoinPriceCard } from '@/components/dashboard/bitcoin-price-card'
import { RoundTimerCard } from '@/components/dashboard/round-timer-card'
import { NumberTransactionsCard } from '@/components/dashboard/number-transactions-card'
import { MovementsTable } from '@/components/movements-table'
import { Button } from '@/components/ui/button'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useSettingsStore } from '@/stores/settings'
import { getBalanceTotals } from '@/utils/balance'

export default function TransactionsPage() {
  const { t } = useTranslation()
  const { data: balance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const discreteMode = useSettingsStore((state) => state.discreteMode)
  const toggleDiscreteMode = useSettingsStore((state) => state.toggleDiscreteMode)
  const { totalSat, pendingSat, onchainSat, onchainPendingSat } = getBalanceTotals(
    balance,
    onchainBalance
  )
  const hasPending = pendingSat > 0
  const hasOnchain = onchainSat > 0
  const hasOnchainPending = onchainPendingSat > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-center">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col justify-center">
            <p className="font-bold text-4xl">{formatSats(totalSat)}</p>
            <AnimatePresence initial={false}>
              {hasPending || hasOnchain || hasOnchainPending ? (
                <m.p
                  animate={{ height: 'auto', opacity: 1 }}
                  className="flex gap-2 overflow-hidden text-muted-foreground text-xs"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {hasPending ? (
                    <span>
                      {t('dashboard.balance.pending', { amount: formatSats(pendingSat) })}
                    </span>
                  ) : null}
                  {hasOnchain ? (
                    <span>
                      {t('dashboard.balance.onchain', { amount: formatSats(onchainSat) })}
                    </span>
                  ) : null}
                  {hasOnchainPending ? (
                    <span>
                      {t('dashboard.balance.onchain_pending', {
                        amount: formatSats(onchainPendingSat)
                      })}
                    </span>
                  ) : null}
                </m.p>
              ) : null}
            </AnimatePresence>
            <div className="flex gap-4 items-center">
              <p className="text-muted-foreground">{formatFiat(totalSat)}</p>
              <Button
                aria-label={
                  discreteMode
                    ? t('dashboard.balance.show_amounts')
                    : t('dashboard.balance.hide_amounts')
                }
                onClick={toggleDiscreteMode}
                size="icon"
                variant="ghost"
              >
                {discreteMode ? <EyeSlashIcon /> : <EyeIcon />}
              </Button>
            </div>
          </div>
        </div>
        <BitcoinPriceCard />
        <NumberTransactionsCard />
        <RoundTimerCard />
      </div>
      <MovementsTable />
      <BalanceChart />
    </div>
  )
}
