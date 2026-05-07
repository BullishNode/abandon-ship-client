import { CoinsIcon } from '@phosphor-icons/react'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { StatCard } from './stat-card'

export function SpendableVtxosCard() {
  const { data: vtxos, isLoading } = useVtxos()

  const count = vtxos?.length ?? 0

  return (
    <StatCard icon={CoinsIcon} title="Spendable VTXOs">
      {isLoading ? '—' : count}
    </StatCard>
  )
}
