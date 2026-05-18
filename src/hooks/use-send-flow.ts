import type { DecodedData, Destination } from 'bitcoin-decoder'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useOnchainSend } from '@/hooks/barkd/use-onchain-send'
import { useSend } from '@/hooks/barkd/use-send'
import { useSendOnchain } from '@/hooks/barkd/use-send-onchain'
import { useSendOnchainFee } from '@/hooks/barkd/use-send-onchain-fee'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useBrantaVerification } from '@/hooks/branta/use-branta-verification'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useMetadataStore } from '@/stores/metadata'
import { formatSatsDisplay, parseSatsInput } from '@/utils/format'
import type { SendRoute } from '@/utils/payment'
import {
  getSendRoute,
  parsePaymentInput,
  pickCheapestDestination,
  sortDestinationsByPriority
} from '@/utils/payment'

export type SendStep = 'scan' | 'send'

interface UseSendFlowOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStep?: SendStep
}

export function useSendFlow({ open, onOpenChange, initialStep = 'scan' }: UseSendFlowOptions) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const upsertBinding = useMetadataStore((state) => state.upsertBinding)

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

  const amountSat = Number.parseInt(amount, 10)
  const validAmountSat = Number.isNaN(amountSat) || amountSat <= 0 ? undefined : amountSat
  const amountDisplay = formatSatsDisplay(amount)

  function handleAmountChange(value: string) {
    setAmount(parseSatsInput(value))
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
    onError: (error) => {
      toast.error(t('send.errors.send_failed'), { description: error.message })
    },
    onSuccess: () => {
      handleSendSuccess()
    }
  })

  const isLightningRoute = sendRoute === 'lightning'
  const isOnchainRoute = sendRoute === 'onchain-from-ark' || sendRoute === 'onchain-from-wallet'
  const { data: lightningSendFee, isFetching: isFetchingLnFee } = useLightningSendFee(
    isLightningRoute ? validAmountSat : undefined
  )
  const { data: onchainSendFee, isFetching: isFetchingOnchainFee } = useSendOnchainFee(
    isOnchainRoute ? validAmountSat : undefined,
    isOnchainRoute ? destination : undefined
  )

  let feeEstimate: { feeSat: number; grossAmountSat?: number } | undefined
  let isFetchingFee = false
  if (sendRoute === 'ark') {
    feeEstimate = { feeSat: 0 }
  } else if (isLightningRoute) {
    feeEstimate = lightningSendFee
    isFetchingFee = isFetchingLnFee
  } else {
    feeEstimate = onchainSendFee
    isFetchingFee = isFetchingOnchainFee
  }

  let feeDisplay = '—'
  if (sendRoute === 'ark') {
    feeDisplay = t('send.fee.free')
  } else if (isFetchingFee) {
    feeDisplay = '...'
  } else if (feeEstimate) {
    feeDisplay = formatBitcoin(feeEstimate.feeSat)
  }
  const feeSat = sendRoute === 'ark' ? undefined : feeEstimate?.feeSat

  const { data: walletBalance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()

  const arkBalanceSat = walletBalance?.spendableSat ?? 0
  const onchainTrustedSpendableSat = onchainBalance?.trustedSpendableSat ?? 0
  const onchainTrustedPendingSat = onchainBalance?.trustedPendingSat ?? 0
  const onchainUntrustedPendingSat = onchainBalance?.untrustedPendingSat ?? 0
  const onchainPendingTotalSat = onchainTrustedPendingSat + onchainUntrustedPendingSat
  const onchainBalanceSat = onchainTrustedSpendableSat + onchainPendingTotalSat

  const availableBalance = sendRoute === 'onchain-from-wallet' ? onchainBalanceSat : arkBalanceSat

  const isOnchainDestination =
    sendRoute === 'onchain-from-ark' || sendRoute === 'onchain-from-wallet'

  const requiredSat =
    validAmountSat === undefined
      ? undefined
      : (feeEstimate?.grossAmountSat ?? validAmountSat + (feeEstimate?.feeSat ?? 0))

  const hasEnoughFunds = requiredSat === undefined ? true : availableBalance >= requiredSat
  const insufficientFunds = requiredSat !== undefined && !hasEnoughFunds
  const usesPendingOnchain =
    sendRoute === 'onchain-from-wallet' &&
    requiredSat !== undefined &&
    hasEnoughFunds &&
    requiredSat > onchainTrustedSpendableSat

  const { data: brantaPayments, isFetching: isFetchingBranta } = useBrantaVerification(
    step === 'send' ? rawQrInput : undefined
  )
  const brantaPayment = brantaPayments?.[0]

  const isSending = isSendingArk || isSendingOnchain || isSendingFromWallet

  function handleClose() {
    onOpenChange(false)
  }

  function applyDestination(dest: Destination) {
    setDestination(dest.destination)
    setSelectedMethodType(dest.type)
    setSendRoute(getSendRoute(dest.type))
  }

  async function goToSend(input: string) {
    setRawQrInput(input)
    const decoded = await parsePaymentInput(input)
    setParsed(decoded)

    if (!decoded.valid) {
      toast.error(t('send.errors.invalid_qr'), {
        description: decoded.errorMessage
      })
      return
    }

    const cheapest = pickCheapestDestination(decoded.destinations)
    applyDestination(cheapest)

    const amountSats = decoded.metadata?.amount
    const description = decoded.metadata?.description

    if (amountSats !== undefined && amountSats !== 0) {
      setAmount(String(amountSats))
    }
    if (description !== undefined && description !== '') {
      setLabel(description)
    }

    setDirection(1)
    setStep('send')
  }

  function goToScan() {
    setDirection(-1)
    setStep('scan')
    setRawQrInput('')
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim() !== '') {
        await goToSend(text)
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

  const chooserDestinations =
    parsed?.valid === true ? sortDestinationsByPriority(parsed.destinations) : []
  const currentDestinationType =
    selectedMethodType ?? (parsed?.valid === true ? parsed.destination.type : undefined)
  const isAmountLocked =
    parsed?.valid === true &&
    (currentDestinationType === 'bolt11' || currentDestinationType === 'bolt12') &&
    parsed.metadata?.amount !== undefined &&
    parsed.metadata.amount > 0

  const canSend =
    destination.trim().length > 0 &&
    validAmountSat !== undefined &&
    hasEnoughFunds &&
    !isFetchingFee

  return {
    amount,
    amountDisplay,
    applyDestination,
    arkBalanceSat,
    availableBalance,
    brantaPayment,
    canSend,
    chooserDestinations,
    destination,
    direction,
    feeDisplay,
    feeSat,
    goToScan,
    goToSend,
    handleClose,
    handleConfirmSend,
    handlePaste,
    insufficientFunds,
    isAmountLocked,
    isFetchingBranta,
    isOnchainDestination,
    isSending,
    label,
    message,
    onchainBalanceSat,
    onchainPendingTotalSat,
    onchainTrustedSpendableSat,
    selectedMethodType,
    selectedTags,
    sendRoute,
    setAmount: handleAmountChange,
    setDestination,
    setLabel,
    setMessage,
    setSelectedTags,
    setSendRoute,
    step,
    usesPendingOnchain,
    validAmountSat
  }
}
