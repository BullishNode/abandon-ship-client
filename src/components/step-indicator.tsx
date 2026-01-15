import clsx from 'clsx'

interface StepIndicatorProps {
  isActive?: boolean
  label?: string
}

export function StepIndicator({ label, isActive }: StepIndicatorProps) {
  return (
    <button className="flex w-full flex-col items-start gap-0.5" type="button">
      <div
        className={clsx('h-1 w-full rounded-full', {
          'bg-primary': isActive,
          'bg-border': !isActive
        })}
      />
      <span
        className={clsx('cursor-pointer font-medium text-xs', {
          'text-primary': isActive,
          'text-border': !isActive
        })}
      >
        {label}
      </span>
    </button>
  )
}
