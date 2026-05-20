import { lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BalanceCard } from '@/components/dashboard/balance-card'
import { RoundPriceCard } from '@/components/dashboard/round-price-card'
import { MovementsTable } from '@/components/movements-table'
import { Skeleton } from '@/components/ui/skeleton'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useSettingsStore } from '@/stores/settings'
import { getBalanceTotals } from '@/utils/balance'

const BalanceChart = lazy(async () => {
  const mod = await import('@/components/balance-chart')
  return { default: mod.BalanceChart }
})

export default function TransactionsPage() {
  const { data: balance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()
  const [discreteMode, toggleDiscreteMode] = useSettingsStore(
    useShallow((state) => [state.discreteMode, state.toggleDiscreteMode])
  )
  const totals = getBalanceTotals(balance, onchainBalance)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BalanceCard
          discreteMode={discreteMode}
          onToggleDiscreteMode={toggleDiscreteMode}
          totals={totals}
        />
        <RoundPriceCard />
      </div>
      <MovementsTable />
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <BalanceChart />
      </Suspense>
    </div>
  )
}
