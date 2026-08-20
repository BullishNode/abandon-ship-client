import type { DecodedData, DecodedPayment, Destination } from 'bitcoin-decoder'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { config } from '@/config/runtime'
import { useBrantaVerification } from '@/hooks/branta/use-branta-verification'
import { normalizeDestination } from '@/utils/bitcoin'
import { canUseCamera } from '@/utils/camera'
import type { SendRoute } from '@/utils/payment'
import {
  getSelectableDestinations,
  getSendRoute,
  parsePaymentInput,
  pickCheapestDestination,
  restrictPaymentToNetwork
} from '@/utils/payment'

export type SendStep = 'scan' | 'send'

interface UseSendDestinationOptions {
  open: boolean
  initialStep?: SendStep
}

export function useSendDestination({ open, initialStep = 'scan' }: UseSendDestinationOptions) {
  const { t } = useTranslation()

  const effectiveInitialStep: SendStep = canUseCamera() ? initialStep : 'send'
  const [step, setStep] = useState<SendStep>(effectiveInitialStep)
  const [direction, setDirection] = useState(1)
  const [destination, setDestination] = useState('')
  const [rawQrInput, setRawQrInput] = useState('')
  const [parsed, setParsed] = useState<DecodedData | undefined>()
  const [selectedMethodType, setSelectedMethodType] = useState<Destination['type'] | undefined>()
  const [sendRoute, setSendRoute] = useState<SendRoute>('lightning')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setStep(effectiveInitialStep)
    setDirection(1)
    setDestination('')
    setRawQrInput('')
    setParsed(undefined)
    setSelectedMethodType(undefined)
    setSendRoute('lightning')
  }

  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  function changeDestination(value: string) {
    setDestination(value)
    setSelectedMethodType(undefined)
    setParsed(undefined)
    setSendRoute('lightning')
  }

  function applyDestination(rawDest: Destination) {
    const dest = normalizeDestination(rawDest)
    setDestination(dest.destination)
    setSelectedMethodType(dest.type)
    setSendRoute(getSendRoute(dest.type))
  }

  // The raw input is what `useBrantaVerification` queries and what
  // `verifyDestination` compares against to skip re-decoding, so a rejected
  // input must not stay behind.
  function rejectInput(message: string, description?: string) {
    setParsed(undefined)
    setRawQrInput('')
    setSelectedMethodType(undefined)
    setSendRoute('lightning')
    if (description === undefined) {
      toast.error(message)
      return
    }
    toast.error(message, { description })
  }

  function applyPayment(
    rawInput: string,
    decoded: DecodedData,
    applyParsedMetadata?: (decoded: DecodedPayment) => void
  ): boolean {
    if (!decoded.valid) {
      rejectInput(t('send.errors.invalid_destination'), decoded.errorMessage)
      return false
    }

    if (decoded.kind !== 'payment') {
      rejectInput(t('send.errors.invalid_destination'))
      return false
    }

    const payable = restrictPaymentToNetwork(decoded, config.network)
    if (payable === undefined) {
      rejectInput(t('send.errors.wrong_network'))
      return false
    }

    setRawQrInput(rawInput)
    setParsed(payable)
    applyDestination(pickCheapestDestination(payable.destinations))
    applyParsedMetadata?.(payable)
    return true
  }

  async function goToSend(
    input: string,
    applyParsedMetadata?: (decoded: DecodedPayment) => void
  ): Promise<DecodedData | undefined> {
    const decoded = await parsePaymentInput(input)
    if (applyPayment(input, decoded, applyParsedMetadata)) {
      setDirection(1)
      setStep('send')
    }
    return decoded
  }

  function goToScan() {
    setDirection(-1)
    setStep('scan')
    setRawQrInput('')
  }

  function clearBrantaVerification() {
    if (rawQrInput !== '') {
      setRawQrInput('')
    }
  }

  async function verifyDestination(
    value: string,
    applyParsedMetadata?: (decoded: DecodedPayment) => void
  ) {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === rawQrInput) {
      return
    }
    if (parsed?.valid === true && parsed.kind === 'payment') {
      const isKnownDestination = parsed.destinations.some(
        (d) => normalizeDestination(d).destination === trimmed
      )
      if (isKnownDestination) {
        return
      }
    }
    const decoded = await parsePaymentInput(trimmed)
    applyPayment(trimmed, decoded, applyParsedMetadata)
  }

  const { data: brantaResult, isFetching: isFetchingBranta } = useBrantaVerification(
    step === 'send' ? rawQrInput : undefined
  )

  const isPayment = parsed?.valid === true && parsed.kind === 'payment'
  const chooserDestinations = isPayment ? getSelectableDestinations(parsed.destinations) : []
  const currentDestinationType =
    selectedMethodType ?? (isPayment ? parsed.destination.type : undefined)
  const isAmountLocked =
    isPayment &&
    (currentDestinationType === 'bolt11' || currentDestinationType === 'bolt12') &&
    parsed.metadata?.amount !== undefined &&
    parsed.metadata.amount > 0
  const isOnchainDestination =
    sendRoute === 'onchain-from-ark' || sendRoute === 'onchain-from-wallet'

  return {
    applyDestination,
    brantaPayment: brantaResult?.payments[0],
    brantaVerifyUrl: brantaResult?.verifyUrl,
    changeDestination,
    chooserDestinations,
    clearBrantaVerification,
    destination,
    direction,
    goToScan,
    goToSend,
    isAmountLocked,
    isFetchingBranta,
    isOnchainDestination,
    selectedMethodType,
    sendRoute,
    setDestination,
    setSendRoute,
    step,
    verifyDestination
  }
}
