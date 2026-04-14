import { cn } from '@/lib/utils'
import { buttonVariants } from './ui/button'

export type SeedWordStatus = 'idle' | 'valid' | 'invalid'

interface SeedWordButtonProps extends React.ComponentProps<'button'> {
  word: string
  selectedPosition?: number
  status: SeedWordStatus
}

export function SeedWordButton({ word, selectedPosition, status, ...props }: SeedWordButtonProps) {
  const statusClasses = {
    idle: 'group-hover:bg-muted',
    invalid: 'bg-destructive text-background hover:bg-destructive hover:text-background',
    valid: 'bg-emerald-500 text-background hover:bg-emerald-500! hover:text-background'
  }

  return (
    <button className="group flex min-w-31.25 cursor-pointer gap-0.5" type="button" {...props}>
      <span
        className={cn(
          buttonVariants({
            className: `min-w-10 rounded-r-none ${statusClasses[status]}`,
            variant: 'outline'
          })
        )}
      >
        {selectedPosition}
      </span>
      <span
        className={cn(
          buttonVariants({
            className: `flex-1 rounded-l-none ${status === 'idle' ? 'group-hover:bg-muted' : 'hover:bg-transparent'}`,
            variant: 'outline'
          })
        )}
      >
        {word}
      </span>
    </button>
  )
}
