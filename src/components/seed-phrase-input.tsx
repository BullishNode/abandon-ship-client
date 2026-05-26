import { EyeIcon, EyeSlashIcon, SpinnerIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

function handleTextareaFocus(event: React.FocusEvent<HTMLTextAreaElement>) {
  event.currentTarget.select()
}

interface SeedPhraseInputProps {
  mnemonic: string | undefined
  isLoading: boolean
  isRevealed: boolean
  onToggle: () => void
  hiddenPlaceholder: string
  revealAriaLabel: string
  hideAriaLabel: string
}

type IconState = 'eye' | 'spinner' | 'eye-off'

function getIconState(isLoading: boolean, isRevealed: boolean): IconState {
  if (isLoading) {
    return 'spinner'
  }
  return isRevealed ? 'eye-off' : 'eye'
}

const ICON_MAP = {
  eye: EyeIcon,
  'eye-off': EyeSlashIcon,
  spinner: SpinnerIcon
} as const

export function SeedPhraseInput({
  mnemonic,
  isLoading,
  isRevealed,
  onToggle,
  hiddenPlaceholder,
  revealAriaLabel,
  hideAriaLabel
}: SeedPhraseInputProps) {
  const showValue = isRevealed && mnemonic !== undefined
  const value = showValue ? mnemonic : hiddenPlaceholder
  const iconState = getIconState(isLoading, isRevealed)
  const Icon = ICON_MAP[iconState]
  const ariaLabel = isRevealed ? hideAriaLabel : revealAriaLabel

  return (
    <InputGroup>
      <InputGroupTextarea
        aria-label="Seed phrase"
        autoComplete="off"
        className={cn(
          'wrap-break-word font-mono text-sm leading-relaxed',
          !showValue && 'text-muted-foreground'
        )}
        onFocus={handleTextareaFocus}
        readOnly
        rows={2}
        spellCheck={false}
        value={value}
      />
      <InputGroupAddon align="inline-end" className="self-start pt-1.5">
        <InputGroupButton
          aria-label={ariaLabel}
          disabled={isLoading}
          onClick={onToggle}
          size="icon-xs"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
              exit={{ filter: 'blur(4px)', opacity: 0.4, scale: 0.95 }}
              initial={{ filter: 'blur(4px)', opacity: 0.4, scale: 0.95 }}
              key={iconState}
              transition={{ duration: 0.25 }}
            >
              <Icon className={iconState === 'spinner' ? 'animate-spin' : undefined} />
            </m.span>
          </AnimatePresence>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
