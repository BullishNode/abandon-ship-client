import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-medium px-2 py-0.5 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border border-foreground/15 bg-muted text-foreground',
        muted: 'bg-muted text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ className, variant }))}
      data-slot="badge"
      {...props}
    />
  )
}

export { Badge, badgeVariants }
