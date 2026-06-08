import { Skeleton } from '@/components/ui/skeleton'

export function MovementsTableSkeleton() {
  return (
    <div className="px-6 py-2">
      <Skeleton className="h-80 w-full" />
    </div>
  )
}
