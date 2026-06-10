import { useSendDestination } from '@/hooks/send/use-send-destination'
import type { SendStep } from '@/hooks/send/use-send-destination'
import { useSendExecute } from '@/hooks/send/use-send-execute'
import { useSendQuote } from '@/hooks/send/use-send-quote'
import { canReadClipboard } from '@/utils/clipboard'

export type { SendStep }

interface UseSendFlowOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStep?: SendStep
}

export function useSendFlow({ open, onOpenChange, initialStep = 'scan' }: UseSendFlowOptions) {
  const dest = useSendDestination({ initialStep, open })
  const quote = useSendQuote({
    destination: dest.destination,
    open,
    sendRoute: dest.sendRoute
  })
  const exec = useSendExecute({
    destination: dest.destination,
    hasEnoughFunds: quote.hasEnoughFunds,
    isFetchingFee: quote.isFetchingFee,
    onOpenChange,
    open,
    selectedMethodType: dest.selectedMethodType,
    sendRoute: dest.sendRoute,
    validAmountSat: quote.validAmountSat
  })

  async function goToSend(input: string) {
    await dest.goToSend(input, (decoded) => {
      const amountSats = decoded.metadata?.amount
      const description = decoded.metadata?.description
      if (amountSats !== undefined && amountSats !== 0) {
        quote.setAmount(String(amountSats))
      }
      if (description !== undefined && description !== '') {
        exec.setLabel(description)
      }
    })
  }

  async function handlePaste() {
    if (!canReadClipboard()) {
      return
    }
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim() !== '') {
        await goToSend(text)
      }
    } catch {
      // intentional: clipboard read denied
    }
  }

  return {
    ...dest,
    ...quote,
    ...exec,
    goToSend,
    handlePaste,
    isPasteSupported: canReadClipboard()
  }
}
