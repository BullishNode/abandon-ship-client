import { lazy, Suspense } from 'react'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { MovementsTable } from '@/components/movements-table'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsStore } from '@/stores/settings'

const BalanceChart = lazy(async () => {
  const mod = await import('@/components/balance-chart')
  return { default: mod.BalanceChart }
})

export default function TransactionsPage() {
  const discreetMode = useSettingsStore((state) => state.discreetMode)
  return (
    <div className="flex flex-col gap-6">
      <OverviewCards />
      <MovementsTable />
      {!discreetMode && (
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <BalanceChart />
        </Suspense>
      )}
    </div>
  )
}
