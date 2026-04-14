import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'
import { formatAddress } from '@/utils/format'
import { buttonVariants } from './ui/button'

interface CopyAddressButtonProps extends React.ComponentProps<'button'> {
  text: string
}

export function CopyAddressButton({ text, ...props }: CopyAddressButtonProps) {
  const { copy, isCopied } = useCopyToClipboard()

  const Icon = isCopied ? CheckIcon : CopyIcon

  return (
    <button
      className={cn(
        buttonVariants({
          className: 'w-full justify-between gap-3',
          variant: 'outline'
        })
      )}
      onClick={() => void copy(text)}
      type="button"
      {...props}
    >
      <span>{formatAddress(text, 16, 16)}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
          exit={{ filter: 'blur(4px)', opacity: 0.4, scale: 0 }}
          initial={{ filter: 'blur(4px)', opacity: 0.4, scale: 0 }}
          key={isCopied ? 'check' : 'copy'}
          transition={{ duration: 0.25 }}
        >
          <Icon />
        </m.span>
      </AnimatePresence>
    </button>
  )
}
