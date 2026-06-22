import { lazy, Suspense } from 'react'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { MovementsTable } from '@/components/movements-table'
import { Skeleton } from '@/components/ui/skeleton'

const BalanceChart = lazy(async () => {
  const mod = await import('@/components/balance-chart')
  return { default: mod.BalanceChart }
})

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <OverviewCards />
      <MovementsTable />
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <BalanceChart />
      </Suspense>
    </div>
  )
}
