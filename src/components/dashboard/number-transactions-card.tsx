import { ArrowsLeftRightIcon } from '@phosphor-icons/react'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { countMovementsInLast30Days } from '@/utils/movement'
import { StatCard } from './stat-card'

export function NumberTransactionsCard() {
  const { data: movements, isLoading } = useWalletTransactions()

  const count = movements ? countMovementsInLast30Days(movements) : 0

  return (
    <StatCard icon={ArrowsLeftRightIcon} title="Transactions (30d)">
      {isLoading ? '—' : count}
    </StatCard>
  )
}
