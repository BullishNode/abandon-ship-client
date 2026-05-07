import type { DecodedData, Destination } from 'bitcoin-decoder'
import { useState } from 'react'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useOnchainSend } from '@/hooks/barkd/use-onchain-send'
import { useSend } from '@/hooks/barkd/use-send'
import { useSendOnchain } from '@/hooks/barkd/use-send-onchain'
import { useSendOnchainFee } from '@/hooks/barkd/use-send-onchain-fee'
import { useBrantaVerification } from '@/hooks/branta/use-branta-verification'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useMetadataStore } from '@/stores/metadata'
import type { SendRoute } from '@/utils/payment'
import { getSendRoute, parsePaymentInput } from '@/utils/payment'

export type SendStep = 'scan' | 'choose-method' | 'send'

interface UseSendFlowOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStep?: 'scan' | 'send'
}

export function useSendFlow({ open, onOpenChange, initialStep = 'scan' }: UseSendFlowOptions) {
  const formatBitcoin = useFormatBitcoin()
  const setAnnotation = useMetadataStore((state) => state.setAnnotation)

  const [step, setStep] = useState<SendStep>(initialStep)
  const [direction, setDirection] = useState(1)
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [rawQrInput, setRawQrInput] = useState('')
  const [parsed, setParsed] = useState<DecodedData | undefined>()
  const [selectedMethodType, setSelectedMethodType] = useState<Destination['type'] | undefined>()
  const [sendRoute, setSendRoute] = useState<SendRoute>('lightning')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setStep(initialStep)
    setDirection(1)
    setDestination('')
    setAmount('')
    setLabel('')
    setMessage('')
    setSelectedTags([])
    setRawQrInput('')
    setParsed(undefined)
    setSelectedMethodType(undefined)
    setSendRoute('lightning')
  }

  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  function handleSendSuccess() {
    const txKey = `${destination}:${amount}:${Date.now()}`
    const hasLabel = label !== ''
    const hasTags = selectedTags.length > 0
    if (hasLabel || hasTags) {
      setAnnotation(txKey, {
        label: hasLabel ? label : undefined,
        tags: selectedTags
      })
    }
    onOpenChange(false)
  }

  const { mutate: send, isPending: isSendingArk } = useSend({
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const { mutate: sendOnchain, isPending: isSendingOnchain } = useSendOnchain({
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const { mutate: onchainSend, isPending: isSendingFromWallet } = useOnchainSend({
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const amountSat = Number.parseInt(amount, 10)
  const validAmountSat = Number.isNaN(amountSat) || amountSat <= 0 ? undefined : amountSat

  const isOnchainRoute = sendRoute === 'onchain-from-ark' || sendRoute === 'onchain-from-wallet'
  const { data: lightningSendFee, isFetching: isFetchingLnFee } = useLightningSendFee(
    isOnchainRoute ? undefined : validAmountSat
  )
  const { data: onchainSendFee, isFetching: isFetchingOnchainFee } = useSendOnchainFee(
    isOnchainRoute ? validAmountSat : undefined,
    isOnchainRoute ? destination : undefined
  )

  const feeEstimate = isOnchainRoute ? onchainSendFee : lightningSendFee
  const isFetchingFee = isOnchainRoute ? isFetchingOnchainFee : isFetchingLnFee

  let feeDisplay = '—'
  if (isFetchingFee) {
    feeDisplay = '...'
  } else if (feeEstimate) {
    feeDisplay = formatBitcoin(feeEstimate.feeSat)
  }

  const { data: brantaPayments, isFetching: isFetchingBranta } = useBrantaVerification(
    step === 'send' ? rawQrInput : undefined
  )
  const brantaPayment = brantaPayments?.[0]

  const isSending = isSendingArk || isSendingOnchain || isSendingFromWallet

  function handleClose() {
    onOpenChange(false)
  }

  async function goToSend(input: string) {
    setRawQrInput(input)
    const decoded = await parsePaymentInput(input)
    setParsed(decoded)

    if (!decoded.valid) {
      setDestination(input.trim())
      setDirection(1)
      setStep('send')
      return
    }

    const amountSats = decoded.metadata?.amount
    const description = decoded.metadata?.description

    if (decoded.destinations.length > 1) {
      setSelectedMethodType(decoded.destination.type)
      setDirection(1)
      setStep('choose-method')

      if (amountSats !== undefined && amountSats !== 0) {
        setAmount(String(amountSats))
      }
      if (description !== undefined && description !== '') {
        setLabel(description)
      }
      return
    }

    setDestination(decoded.destination.destination)
    setSendRoute(getSendRoute(decoded.destination.type))

    if (amountSats !== undefined && amountSats !== 0) {
      setAmount(String(amountSats))
    }
    if (description !== undefined && description !== '') {
      setLabel(description)
    }

    setDirection(1)
    setStep('send')
  }

  function handleChooseMethodConfirm() {
    if (parsed?.valid !== true || selectedMethodType === undefined) {
      return
    }
    const match = parsed.destinations.find((d) => d.type === selectedMethodType)
    setDestination(match?.destination ?? parsed.destination.destination)
    setSendRoute(getSendRoute(selectedMethodType))
    setDirection(1)
    setStep('send')
  }

  function goToScan() {
    setDirection(-1)
    setStep('scan')
    setRawQrInput('')
  }

  function goBackFromChooseMethod() {
    setDirection(-1)
    setStep('scan')
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim() !== '') {
        void goToSend(text)
      }
    } catch {
      // intentional: clipboard read denied
    }
  }

  function handleConfirmSend() {
    const sendAmountSat = validAmountSat

    if (sendRoute === 'ark' || sendRoute === 'lightning') {
      send({
        amountSat: sendAmountSat,
        comment: message === '' ? undefined : message,
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

  const canSend = destination.trim().length > 0
  const chooserDestinations = parsed?.valid === true ? parsed.destinations : []
  const currentDestinationType =
    selectedMethodType ?? (parsed?.valid === true ? parsed.destination.type : undefined)
  const isAmountLocked =
    parsed?.valid === true &&
    (currentDestinationType === 'bolt11' || currentDestinationType === 'bolt12') &&
    parsed.metadata?.amount !== undefined &&
    parsed.metadata.amount > 0

  return {
    amount,
    brantaPayment,
    canSend,
    chooserDestinations,
    destination,
    direction,
    feeDisplay,
    goBackFromChooseMethod,
    goToScan,
    goToSend,
    handleChooseMethodConfirm,
    handleClose,
    handleConfirmSend,
    handlePaste,
    isAmountLocked,
    isFetchingBranta,
    isSending,
    label,
    message,
    selectedMethodType,
    selectedTags,
    sendRoute,
    setAmount,
    setDestination,
    setLabel,
    setMessage,
    setSelectedMethodType,
    setSelectedTags,
    step
  }
}
