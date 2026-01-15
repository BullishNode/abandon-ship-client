import { cn } from '@/lib/utils'

export function SeedLayout({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('grid grid-cols-4 gap-4', className)} {...props} />
}
