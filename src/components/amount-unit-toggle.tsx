import { ArrowsDownUpIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { AmountEntryMode } from '@/types/bitcoin'

interface AmountUnitToggleProps {
  unitLabel: string
  entryMode: AmountEntryMode
  canToggle: boolean
  disabled?: boolean
  onToggle: () => void
}

export function AmountUnitToggle({
  unitLabel,
  entryMode,
  canToggle,
  disabled,
  onToggle
}: AmountUnitToggleProps) {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
      {unitLabel}
      {canToggle && (
        <button
          aria-label={t(
            entryMode === 'bitcoin' ? 'amount.switch_to_fiat' : 'amount.switch_to_bitcoin'
          )}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          onClick={onToggle}
          type="button"
        >
          <ArrowsDownUpIcon className="size-4" />
        </button>
      )}
    </span>
  )
}
