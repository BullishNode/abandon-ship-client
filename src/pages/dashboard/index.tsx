import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { BalanceChart } from '@/components/balance-chart'
import { BitcoinPriceCard } from '@/components/dashboard/bitcoin-price-card'
import { RoundTimerCard } from '@/components/dashboard/round-timer-card'
import { SpendableVtxosCard } from '@/components/dashboard/spendable-vtxos-card'
import { MovementsTable } from '@/components/movements-table'
import { Button } from '@/components/ui/button'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useSettingsStore } from '@/stores/settings'

export default function TransactionsPage() {
  const { data: balance } = useWalletBalance()
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const discreteMode = useSettingsStore((state) => state.discreteMode)
  const toggleDiscreteMode = useSettingsStore((state) => state.toggleDiscreteMode)

  const balanceSats = balance?.spendableSat ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col justify-center">
            <p className="font-bold text-4xl">{formatSats(balanceSats)}</p>
            <div className="flex gap-4 items-center">
              <p className="text-muted-foreground">{formatFiat(balanceSats)}</p>
              <Button
                aria-label={discreteMode ? 'Show amounts' : 'Hide amounts'}
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
        <SpendableVtxosCard />
        <RoundTimerCard />
      </div>
      <MovementsTable />
      <BalanceChart />
    </div>
  )
}
