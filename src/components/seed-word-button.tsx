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
    idle: 'hover:bg-muted dark:hover:bg-muted group-hover:bg-muted dark:group-hover:bg-muted',
    invalid:
      'bg-destructive dark:bg-destructive text-background hover:bg-destructive dark:hover:bg-destructive hover:text-background',
    valid:
      'bg-emerald-500 dark:bg-emerald-500 text-background hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-background'
  }

  const wordClasses =
    status === 'idle'
      ? 'hover:bg-muted dark:hover:bg-muted group-hover:bg-muted dark:group-hover:bg-muted'
      : 'hover:bg-background dark:hover:bg-input/30'

  return (
    <button className="group flex min-w-0 cursor-pointer gap-0.5" type="button" {...props}>
      <span
        className={cn(
          buttonVariants({
            className: `min-w-8 rounded-r-none ${statusClasses[status]}`,
            variant: 'outline'
          })
        )}
      >
        {selectedPosition}
      </span>
      <span
        className={cn(
          buttonVariants({
            className: `min-w-0 flex-1 rounded-l-none ${wordClasses}`,
            variant: 'outline'
          })
        )}
      >
        {word}
      </span>
    </button>
  )
}
