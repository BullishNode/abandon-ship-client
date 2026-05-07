import { CaretDownIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import type { DecodedData, Destination } from 'bitcoin-decoder'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle
} from '@/components/modal'
import { QRScanner } from '@/components/qr-scanner'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBrantaVerification } from '@/hooks/branta/use-branta-verification'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useOnchainSend } from '@/hooks/barkd/use-onchain-send'
import { useSend } from '@/hooks/barkd/use-send'
import { useSendOnchain } from '@/hooks/barkd/use-send-onchain'
import { useSendOnchainFee } from '@/hooks/barkd/use-send-onchain-fee'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useMetadataStore } from '@/stores/metadata'
import type { SendRoute } from '@/utils/payment'
import { getSendRoute, parsePaymentInput } from '@/utils/payment'

type Step = 'scan' | 'choose-method' | 'send'

interface SendModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStep?: 'scan' | 'send'
}

const slideVariants = {
  center: {
    opacity: 1,
    x: 0
  },
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? '100%' : '-100%'
  }),
  exit: {
    opacity: 0,
    transition: { duration: 0.1 }
  }
}

function getRouteLabel(route: SendRoute, t: (key: string) => string): string {
  if (route === 'ark') {
    return t('send.route.ark')
  }
  if (route === 'lightning') {
    return t('send.route.lightning')
  }
  if (route === 'onchain-from-ark') {
    return t('send.route.onchain_from_ark')
  }
  return t('send.route.onchain_from_wallet')
}

function getDestinationTypeLabel(type: Destination['type']): string {
  if (type === 'ark-address') {
    return 'Ark'
  }
  if (type === 'bolt11' || type === 'lnaddress' || type === 'lnurl') {
    return 'Lightning'
  }
  if (type === 'bolt12') {
    return 'BOLT12 Offer'
  }
  return 'On-chain'
}

export function SendModal({ open, onOpenChange, initialStep = 'scan' }: SendModalProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const setAnnotation = useMetadataStore((state) => state.setAnnotation)

  const [step, setStep] = useState<Step>(initialStep)
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

  const { mutate: send, isPending: isSendingArk } = useSend({
    onSuccess: () => handleSendSuccess()
  })

  const { mutate: sendOnchain, isPending: isSendingOnchain } = useSendOnchain({
    onSuccess: () => handleSendSuccess()
  })

  const { mutate: onchainSend, isPending: isSendingFromWallet } = useOnchainSend({
    onSuccess: () => handleSendSuccess()
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
    handleClose()
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
      // Clipboard access denied
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
    } else if (sendRoute === 'onchain-from-ark') {
      if (sendAmountSat === undefined) {
        return
      }
      sendOnchain({
        amountSat: sendAmountSat,
        destination
      })
    } else {
      if (sendAmountSat === undefined) {
        return
      }
      onchainSend({
        amountSat: sendAmountSat,
        destination
      })
    }
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

  return (
    <Modal onClose={handleClose} setShowModal={onOpenChange} showModal={open}>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-1">
        <AnimatePresence custom={direction} initial={false} mode="popLayout">
          {step === 'scan' && (
            <m.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={direction}
              exit="exit"
              initial="enter"
              key="scan"
              transition={{
                opacity: { duration: 0.1 },
                x: { damping: 30, stiffness: 300, type: 'spring' }
              }}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.title')}</ModalTitle>
                <ModalDescription>{t('send.scan.description')}</ModalDescription>
              </ModalHeader>
              <ModalBody>
                <QRScanner
                  className="mx-auto aspect-square w-full"
                  onScan={(v) => void goToSend(v)}
                />
              </ModalBody>
              <ModalFooter className="items-center">
                <Button onClick={() => void handlePaste()} variant="outline">
                  <ClipboardTextIcon />
                  {t('actions.paste')}
                </Button>
              </ModalFooter>
            </m.div>
          )}
          {step === 'choose-method' && (
            <m.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={direction}
              exit="exit"
              initial="enter"
              key="choose-method"
              transition={{
                opacity: { duration: 0.1 },
                x: { damping: 30, stiffness: 300, type: 'spring' }
              }}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.choose_method')}</ModalTitle>
                <ModalDescription>{t('send.choose_method_description')}</ModalDescription>
              </ModalHeader>
              <ModalBody className="flex flex-col gap-2">
                {chooserDestinations.map((dest) => (
                  <button
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedMethodType === dest.type
                        ? 'border-foreground bg-muted'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    key={`${dest.type}-${dest.destination}`}
                    onClick={() => setSelectedMethodType(dest.type)}
                    type="button"
                  >
                    <span className="font-medium text-sm">
                      {getDestinationTypeLabel(dest.type)}
                    </span>
                  </button>
                ))}
              </ModalBody>
              <ModalFooter>
                <Button onClick={goBackFromChooseMethod} variant="outline">
                  {t('actions.back')}
                </Button>
                <Button
                  disabled={selectedMethodType === undefined}
                  onClick={handleChooseMethodConfirm}
                >
                  {t('actions.continue')}
                </Button>
              </ModalFooter>
            </m.div>
          )}
          {step === 'send' && (
            <m.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={direction}
              exit="exit"
              initial="enter"
              key="send"
              transition={{
                opacity: { duration: 0.1 },
                x: { damping: 30, stiffness: 300, type: 'spring' }
              }}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.title')}</ModalTitle>
                <ModalDescription>{t('send.confirm.description')}</ModalDescription>
              </ModalHeader>
              <ModalBody className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="destination">{t('send.destination')}</Label>
                    {destination.trim() !== '' && (
                      <span className="text-muted-foreground text-xs">
                        {getRouteLabel(sendRoute, t)}
                      </span>
                    )}
                  </div>
                  <Input
                    id="destination"
                    onChange={(e) => setDestination(e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text').trim()
                      if (text !== '') {
                        e.preventDefault()
                        void goToSend(text)
                      }
                    }}
                    placeholder={t('send.destination.placeholder')}
                    type="text"
                    value={destination}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="send-amount">{t('send.amount')}</Label>
                  <Input
                    disabled={isAmountLocked}
                    endTextAddOn={t('bitcoin.sats_unit_other')}
                    id="send-amount"
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    type="text"
                    value={amount}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">{t('send.fee.estimate')}</Label>
                  <span className="text-muted-foreground text-sm">{feeDisplay}</span>
                </div>
                {isFetchingBranta && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-muted-foreground">{t('send.branta.title')}</Label>
                    <span className="text-muted-foreground animate-pulse text-sm">...</span>
                  </div>
                )}
                {!isFetchingBranta && brantaPayment !== undefined && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-muted-foreground">{t('send.branta.title')}</Label>
                    <a
                      className="flex items-center gap-2 text-sm"
                      href={brantaPayment.verifyUrl}
                      rel="noopener"
                      target="_blank"
                    >
                      {(brantaPayment.platformLogoLightUrl ?? brantaPayment.platformLogoUrl) !==
                        undefined &&
                        (brantaPayment.platformLogoLightUrl ?? brantaPayment.platformLogoUrl) !==
                          '' && (
                          <img
                            alt={brantaPayment.platform ?? ''}
                            className={`max-h-6 w-auto rounded object-contain p-0.5${brantaPayment.platformLogoLightUrl !== undefined && brantaPayment.platformLogoLightUrl !== '' ? '' : ' bg-black'}`}
                            src={
                              brantaPayment.platformLogoLightUrl ?? brantaPayment.platformLogoUrl
                            }
                          />
                        )}
                      {brantaPayment.platform}
                    </a>
                  </div>
                )}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Label className="flex items-center justify-between">
                      {t('send.details')}
                      <CaretDownIcon className="size-4" />
                    </Label>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-4 pt-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="send-label">{t('send.label')}</Label>
                      <Input
                        id="send-label"
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder={t('send.label.placeholder')}
                        type="text"
                        value={label}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="send-message">{t('send.message')}</Label>
                      <Input
                        id="send-message"
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t('send.message.placeholder')}
                        type="text"
                        value={message}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>{t('tags.label')}</Label>
                      <TagInput onChange={setSelectedTags} value={selectedTags} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </ModalBody>
              <ModalFooter>
                <Button onClick={goToScan} variant="outline">
                  {t('actions.back')}
                </Button>
                <Button disabled={!canSend} loading={isSending} onClick={handleConfirmSend}>
                  {t('send.confirm.button')}
                </Button>
              </ModalFooter>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
