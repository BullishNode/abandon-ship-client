import type { DecodedData, DecodedPayment, Destination } from 'bitcoin-decoder'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useBrantaVerification } from '@/hooks/branta/use-branta-verification'
import { normalizeDestination } from '@/utils/bitcoin'
import type { SendRoute } from '@/utils/payment'
import {
  getSendRoute,
  parsePaymentInput,
  pickCheapestDestination,
  sortDestinationsByPriority
} from '@/utils/payment'

export type SendStep = 'scan' | 'send'

interface UseSendDestinationOptions {
  open: boolean
  initialStep?: SendStep
}

export function useSendDestination({ open, initialStep = 'scan' }: UseSendDestinationOptions) {
  const { t } = useTranslation()

  const [step, setStep] = useState<SendStep>(initialStep)
  const [direction, setDirection] = useState(1)
  const [destination, setDestination] = useState('')
  const [rawQrInput, setRawQrInput] = useState('')
  const [parsed, setParsed] = useState<DecodedData | undefined>()
  const [selectedMethodType, setSelectedMethodType] = useState<Destination['type'] | undefined>()
  const [sendRoute, setSendRoute] = useState<SendRoute>('lightning')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setStep(initialStep)
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

  function applyDestination(rawDest: Destination) {
    const dest = normalizeDestination(rawDest)
    setDestination(dest.destination)
    setSelectedMethodType(dest.type)
    setSendRoute(getSendRoute(dest.type))
  }

  async function goToSend(
    input: string,
    applyParsedMetadata?: (decoded: DecodedPayment) => void
  ): Promise<DecodedData | undefined> {
    setRawQrInput(input)
    const decoded = await parsePaymentInput(input)
    setParsed(decoded)

    if (!decoded.valid) {
      toast.error(t('send.errors.invalid_qr'), {
        description: decoded.errorMessage
      })
      return decoded
    }

    if (decoded.kind !== 'payment') {
      toast.error(t('send.errors.invalid_qr'))
      return decoded
    }

    const cheapest = pickCheapestDestination(decoded.destinations)
    applyDestination(cheapest)
    applyParsedMetadata?.(decoded)
    setDirection(1)
    setStep('send')
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

  async function verifyDestination(value: string) {
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
    if (decoded.valid && decoded.kind === 'payment') {
      applyDestination(pickCheapestDestination(decoded.destinations))
      setParsed(decoded)
      setRawQrInput(trimmed)
    }
  }

  const { data: brantaResult, isFetching: isFetchingBranta } = useBrantaVerification(
    step === 'send' ? rawQrInput : undefined
  )

  const isPayment = parsed?.valid === true && parsed.kind === 'payment'
  const chooserDestinations = isPayment ? sortDestinationsByPriority(parsed.destinations) : []
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
