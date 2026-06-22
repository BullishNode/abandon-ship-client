import { OverviewCards } from '@/components/dashboard/overview-cards'
import { VtxosTable } from '@/components/vtxos/vtxos-table'

export default function VtxosPage() {
  return (
    <div className="flex flex-col gap-6">
      <OverviewCards bottomMetric="blockHeight" />
      <VtxosTable />
    </div>
  )
}
