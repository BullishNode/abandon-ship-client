import { useShallow } from 'zustand/react/shallow'
import { BalanceChart } from '@/components/balance-chart'
import { BalanceCard } from '@/components/dashboard/balance-card'
import { BitcoinPriceCard } from '@/components/dashboard/bitcoin-price-card'
import { NumberTransactionsCard } from '@/components/dashboard/number-transactions-card'
import { RoundTimerCard } from '@/components/dashboard/round-timer-card'
import { MovementsTable } from '@/components/movements-table'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useSettingsStore } from '@/stores/settings'
import { getBalanceTotals } from '@/utils/balance'

export default function TransactionsPage() {
  const { data: balance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()
  const [discreteMode, toggleDiscreteMode] = useSettingsStore(
    useShallow((state) => [state.discreteMode, state.toggleDiscreteMode])
  )
  const totals = getBalanceTotals(balance, onchainBalance)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3 xl:grid-cols-4">
        <BalanceCard
          discreteMode={discreteMode}
          onToggleDiscreteMode={toggleDiscreteMode}
          totals={totals}
          className="md:col-span-3 xl:col-span-1"
        />
        <BitcoinPriceCard />
        <NumberTransactionsCard />
        <RoundTimerCard />
      </div>
      <MovementsTable />
      <BalanceChart />
    </div>
  )
}
