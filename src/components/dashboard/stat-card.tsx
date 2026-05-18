import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatCardProps {
  icon: Icon
  title: string
  children: ReactNode
}

export function StatCard({ icon: IconComponent, title, children }: StatCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <IconComponent size={16} weight="regular" />
          <span className="min-w-0 truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{children}</div>
      </CardContent>
    </Card>
  )
}
