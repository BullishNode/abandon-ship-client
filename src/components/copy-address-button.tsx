import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
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
          variant: 'outline',
          className: 'w-full justify-between gap-3'
        })
      )}
      onClick={() => copy(text)}
      type="button"
      {...props}
    >
      <span>{formatAddress(text, 16, 16)}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0, opacity: 0.4, filter: 'blur(4px)' }}
          initial={{ scale: 0, opacity: 0.4, filter: 'blur(4px)' }}
          key={isCopied ? 'check' : 'copy'}
          transition={{ duration: 0.25 }}
        >
          <Icon />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
