import type { Destination } from 'bitcoin-decoder'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useOnchainSend } from '@/hooks/barkd/use-onchain-send'
import { useSend } from '@/hooks/barkd/use-send'
import { useSendOnchain } from '@/hooks/barkd/use-send-onchain'
import { useMetadataStore } from '@/stores/metadata'
import type { SendRoute } from '@/utils/payment'

interface UseSendExecuteOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  destination: string
  sendRoute: SendRoute
  selectedMethodType: Destination['type'] | undefined
  validAmountSat: number | undefined
  hasEnoughFunds: boolean
  isFetchingFee: boolean
}

export function useSendExecute({
  open,
  onOpenChange,
  destination,
  sendRoute,
  selectedMethodType,
  validAmountSat,
  hasEnoughFunds,
  isFetchingFee
}: UseSendExecuteOptions) {
  const { t } = useTranslation()
  const upsertBinding = useMetadataStore((state) => state.upsertBinding)

  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setLabel('')
    setMessage('')
    setSelectedTags([])
  }

  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  function handleSendSuccess() {
    const trimmedLabel = label.trim()
    const hasLabel = trimmedLabel !== ''
    const hasTags = selectedTags.length > 0
    if ((hasLabel || hasTags) && destination !== '') {
      upsertBinding({
        destinations: [destination],
        direction: 'outgoing',
        label: hasLabel ? trimmedLabel : undefined,
        tags: selectedTags
      })
    }
    onOpenChange(false)
  }

  const { mutate: send, isPending: isSendingArk } = useSend({
    onError: (error) => {
      toast.error(t('send.errors.send_failed'), { description: error.message })
    },
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const { mutate: sendOnchain, isPending: isSendingOnchain } = useSendOnchain({
    onError: (error) => {
      toast.error(t('send.errors.send_failed'), { description: error.message })
    },
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const { mutate: onchainSend, isPending: isSendingFromWallet } = useOnchainSend({
    onError: (error) => {
      toast.error(t('send.errors.send_failed'), { description: error.message })
    },
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const isSending = isSendingArk || isSendingOnchain || isSendingFromWallet

  function handleClose() {
    onOpenChange(false)
  }

  function handleConfirmSend() {
    const sendAmountSat = validAmountSat

    if (sendRoute === 'ark' || sendRoute === 'lightning') {
      send({
        amountSat: sendAmountSat,
        comment: selectedMethodType === 'lnaddress' && message !== '' ? message : undefined,
        destination
      })
      return
    }

    if (sendAmountSat === undefined) {
      return
    }

    if (sendRoute === 'onchain-from-ark') {
      sendOnchain({ amountSat: sendAmountSat, destination })
      return
    }

    onchainSend({ amountSat: sendAmountSat, destination })
  }

  const canSend =
    destination.trim().length > 0 &&
    validAmountSat !== undefined &&
    hasEnoughFunds &&
    !isFetchingFee

  return {
    canSend,
    handleClose,
    handleConfirmSend,
    isSending,
    label,
    message,
    selectedTags,
    setLabel,
    setMessage,
    setSelectedTags
  }
}
