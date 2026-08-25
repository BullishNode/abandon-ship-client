import { clsx } from 'clsx'
import { m } from 'motion/react'

interface StepIndicatorProps {
  isActive: boolean
  label?: string
}

export function StepIndicator({ label, isActive }: StepIndicatorProps) {
  return (
    <button className="flex w-full flex-col items-start gap-0.5" type="button">
      <div className="h-1 w-full overflow-hidden rounded-full bg-border">
        <m.div
          animate={{ width: isActive ? '100%' : '0%' }}
          className="h-full rounded-full bg-primary"
          initial={false}
          transition={{ damping: 30, stiffness: 300, type: 'spring' }}
        />
      </div>
      <span
        className={clsx('cursor-pointer font-medium text-xs transition-colors', {
          'text-border': !isActive,
          'text-primary': isActive
        })}
      >
        {label}
      </span>
    </button>
  )
}
