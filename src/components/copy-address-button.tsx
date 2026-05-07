import { ArrowsInSimpleIcon, ArrowsOutSimpleIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea
} from '@/components/ui/input-group'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useElementMetrics } from '@/hooks/use-element-metrics'
import { truncateMiddle } from '@/utils/truncate-middle'

interface CopyAddressButtonProps {
  text: string
}

function handleTextareaFocus(event: React.FocusEvent<HTMLTextAreaElement>) {
  event.currentTarget.select()
}

interface TruncatedAddressProps {
  text: string
}

function TruncatedAddress({ text }: TruncatedAddressProps) {
  const [{ width, font }, ref] = useElementMetrics()
  const display = width > 0 && font !== '' ? truncateMiddle(text, font, width) : text

  return (
    <div
      className="min-w-0 flex-1 overflow-hidden whitespace-nowrap px-2.5 text-sm"
      data-slot="input-group-control"
      ref={ref}
    >
      {display}
    </div>
  )
}

export function CopyAddressButton({ text }: CopyAddressButtonProps) {
  const { copy, isCopied } = useCopyToClipboard()
  const [expanded, setExpanded] = useState(false)

  const Icon = isCopied ? CheckIcon : CopyIcon
  const ExpandIcon = expanded ? ArrowsInSimpleIcon : ArrowsOutSimpleIcon

  return (
    <InputGroup>
      {expanded ? (
        <InputGroupTextarea
          className="break-all text-sm"
          onFocus={handleTextareaFocus}
          readOnly
          rows={4}
          value={text}
        />
      ) : (
        <TruncatedAddress text={text} />
      )}
      <InputGroupAddon align="inline-end" className={expanded ? 'self-start pt-1.5' : undefined}>
        <InputGroupButton
          aria-label={isCopied ? 'Copied' : 'Copy'}
          onClick={() => void copy(text)}
          size="icon-xs"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
              exit={{ filter: 'blur(4px)', opacity: 0.4, scale: 0.95 }}
              initial={{ filter: 'blur(4px)', opacity: 0.4, scale: 0.95 }}
              key={isCopied ? 'check' : 'copy'}
              transition={{ duration: 0.25 }}
            >
              <Icon />
            </m.span>
          </AnimatePresence>
        </InputGroupButton>
        <InputGroupButton
          aria-label={expanded ? 'Collapse' : 'Expand'}
          onClick={() => setExpanded((value) => !value)}
          size="icon-xs"
        >
          <ExpandIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
