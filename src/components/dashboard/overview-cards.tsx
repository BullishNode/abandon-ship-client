import { useShallow } from 'zustand/react/shallow'
import { BalanceCard } from '@/components/dashboard/balance-card'
import { StatsCard } from '@/components/dashboard/stats-card'
import { useBalanceTotals } from '@/hooks/use-balance-totals'
import { useSettingsStore } from '@/stores/settings'

interface OverviewCardsProps {
  bottomMetric?: 'blockHeight' | 'price'
}

export function OverviewCards({ bottomMetric }: OverviewCardsProps) {
  const totals = useBalanceTotals()
  const [discreetMode, toggleDiscreetMode] = useSettingsStore(
    useShallow((state) => [state.discreetMode, state.toggleDiscreetMode])
  )
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BalanceCard
        discreetMode={discreetMode}
        onToggleDiscreetMode={toggleDiscreetMode}
        totals={totals}
      />
      <StatsCard bottomMetric={bottomMetric} />
    </div>
  )
}
