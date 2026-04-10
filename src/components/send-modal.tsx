import { CaretDownIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import { decode } from 'bitcoin-decoder'
import { AnimatePresence, motion } from 'motion/react'
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
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useSend } from '@/hooks/barkd/use-send'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'

type Step = 'scan' | 'send'

interface SendModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStep?: Step
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0
  })
}

async function parsePaymentInput(input: string) {
  const trimmed = input.trim()

  try {
    const result = await decode(trimmed)
    // TODO: Allow multiple destinations
    if (result.valid) {
      return {
        destination: result.destination.destination,
        amountSats: result.metadata?.amount,
        description: result.metadata?.description
      }
    }
  } catch {
    // Unrecognized format, treat as raw input
  }

  return {
    destination: trimmed,
    amountSats: undefined,
    description: undefined
  }
}

export function SendModal({
  open,
  onOpenChange,
  initialStep = 'scan'
}: SendModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>(initialStep)
  const [direction, setDirection] = useState(1)
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setStep(initialStep)
    setDirection(1)
    setDestination('')
    setAmount('')
    setLabel('')
    setMessage('')
  }

  if (open !== prevOpen) {
    setPrevOpen(open)
  }
  const { mutate: send, isPending: isSending } = useSend({
    onSuccess: () => {
      handleClose()
    }
  })

  const formatBitcoin = useFormatBitcoin()
  const amountSat = Number.parseInt(amount, 10)
  const { data: feeEstimate, isFetching: isFetchingFee } = useLightningSendFee(
    Number.isNaN(amountSat) ? undefined : amountSat
  )

  let feeDisplay = '—'
  if (isFetchingFee) {
    feeDisplay = '...'
  } else if (feeEstimate) {
    feeDisplay = formatBitcoin(feeEstimate.feeSat)
  }

  const handleClose = () => {
    onOpenChange(false)
    setStep(initialStep)
    setDirection(1)
    setDestination('')
    setAmount('')
    setLabel('')
    setMessage('')
  }

  const goToSend = async (input: string) => {
    const parsed = await parsePaymentInput(input)
    setDestination(parsed.destination)
    if (parsed.amountSats) {
      setAmount(String(parsed.amountSats))
    }
    if (parsed.description) {
      setMessage(parsed.description)
    }
    setDirection(1)
    setStep('send')
  }

  const goToScan = () => {
    setDirection(-1)
    setStep('scan')
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        goToSend(text)
      }
    } catch {
      // Clipboard access denied
    }
  }

  const handleConfirmSend = () => {
    const amountSats = Number.parseInt(amount, 10)
    send({
      destination,
      amountSat: Number.isNaN(amountSats) ? undefined : amountSats,
      comment: message || undefined
    })
  }

  const canSend = destination.trim().length > 0

  return (
    <Modal onClose={handleClose} setShowModal={onOpenChange} showModal={open}>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-1">
        <AnimatePresence custom={direction} initial={false} mode="popLayout">
          {step === 'scan' && (
            <motion.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={direction}
              exit="exit"
              initial="enter"
              key="scan"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.title')}</ModalTitle>
                <ModalDescription>
                  {t('send.scan.description')}
                </ModalDescription>
              </ModalHeader>
              <ModalBody>
                <QRScanner
                  className="mx-auto aspect-square w-full"
                  onScan={goToSend}
                />
              </ModalBody>
              <ModalFooter className="items-center">
                <Button onClick={handlePaste} variant="outline">
                  <ClipboardTextIcon />
                  {t('actions.paste')}
                </Button>
              </ModalFooter>
            </motion.div>
          )}
          {step === 'send' && (
            <motion.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={direction}
              exit="exit"
              initial="enter"
              key="send"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.title')}</ModalTitle>
                <ModalDescription>
                  {t('send.confirm.description')}
                </ModalDescription>
              </ModalHeader>
              <ModalBody className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="destination">{t('send.destination')}</Label>
                  <Input
                    id="destination"
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={t('send.destination.placeholder')}
                    type="text"
                    value={destination}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="send-amount">{t('send.amount')}</Label>
                  <Input
                    id="send-amount"
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    type="text"
                    value={amount}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">
                    {t('send.fee.estimate')}
                  </Label>
                  <span className="text-muted-foreground text-sm">
                    {feeDisplay}
                  </span>
                </div>
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
                  </CollapsibleContent>
                </Collapsible>
              </ModalBody>
              <ModalFooter>
                <Button onClick={goToScan} variant="outline">
                  {t('actions.back')}
                </Button>
                <Button
                  disabled={!canSend}
                  loading={isSending}
                  onClick={handleConfirmSend}
                >
                  {t('send.confirm.button')}
                </Button>
              </ModalFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
