import { CaretDownIcon, ClipboardTextIcon, ScanIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AmountUnitToggle } from '@/components/amount-unit-toggle'
import { BrantaVerificationStatus } from '@/components/branta-verification-status'
import { DestinationPicker } from '@/components/destination-picker'
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle
} from '@/components/modal'
import { QRScanner } from '@/components/qr-scanner'
import { slideTransition, slideVariants } from '@/components/step-slide'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { useSendFlow } from '@/hooks/use-send-flow'
import { cn } from '@/lib/utils'
import type { SendRoute } from '@/utils/payment'

interface SendModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStep?: 'scan' | 'send'
}

function getRouteLabel(route: SendRoute, t: (key: string) => string): string {
  if (route === 'ark') {
    return t('send.route.ark')
  }
  if (route === 'lightning') {
    return t('send.route.lightning')
  }
  return t('send.route.onchain')
}

export function SendModal({ open, onOpenChange, initialStep = 'scan' }: SendModalProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const formatFiat = useFormatFiat()
  const flow = useSendFlow({ initialStep, onOpenChange, open })
  const showPicker = flow.chooserDestinations.length > 1
  const isLnAddress = flow.selectedMethodType === 'lnaddress'

  return (
    <Modal onClose={flow.handleClose} setShowModal={onOpenChange} showModal={open}>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-1">
        <AnimatePresence custom={flow.direction} initial={false} mode="popLayout">
          {flow.step === 'scan' && flow.isScanSupported && (
            <m.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={flow.direction}
              exit="exit"
              initial="enter"
              key="scan"
              transition={slideTransition}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.title')}</ModalTitle>
                <ModalDescription>{t('send.scan.description')}</ModalDescription>
              </ModalHeader>
              <ModalBody>
                <QRScanner
                  className="mx-auto aspect-square w-full"
                  onScan={(v) => void flow.goToSend(v)}
                />
              </ModalBody>
              <ModalFooter className="items-center">
                {flow.isPasteSupported && (
                  <Button onClick={() => void flow.handlePaste()} variant="outline">
                    <ClipboardTextIcon />
                    {t('actions.paste')}
                  </Button>
                )}
              </ModalFooter>
            </m.div>
          )}
          {flow.step === 'send' && (
            <m.div
              animate="center"
              className="flex min-h-0 flex-1 flex-col gap-6"
              custom={flow.direction}
              exit="exit"
              initial="enter"
              key="send"
              transition={slideTransition}
              variants={slideVariants}
            >
              <ModalHeader>
                <ModalTitle>{t('send.title')}</ModalTitle>
              </ModalHeader>
              <ModalBody className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="destination">{t('send.destination')}</Label>
                    {flow.selectedMethodType !== undefined && !showPicker && (
                      <span className="text-muted-foreground text-xs leading-none">
                        {getRouteLabel(flow.sendRoute, t)}
                      </span>
                    )}
                  </div>
                  <Input
                    id="destination"
                    onBlur={(e) => void flow.verifyDestination(e.currentTarget.value)}
                    onChange={(e) => {
                      flow.changeDestination(e.target.value)
                      flow.clearBrantaVerification()
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text').trim()
                      if (text !== '') {
                        e.preventDefault()
                        flow.changeDestination(text)
                        void flow.goToSend(text)
                      }
                    }}
                    placeholder={t('send.destination_placeholder')}
                    type="text"
                    value={flow.destination}
                  />
                  {showPicker && (
                    <DestinationPicker
                      amountSat={flow.validAmountSat}
                      destinations={flow.chooserDestinations}
                      onSelect={flow.applyDestination}
                      selectedDestination={flow.destination}
                    />
                  )}
                  <BrantaVerificationStatus
                    key={
                      flow.brantaPayment?.platformLogoLightUrl ??
                      flow.brantaPayment?.platformLogoUrl ??
                      'pending'
                    }
                    payment={flow.brantaPayment}
                    verifyUrl={flow.brantaVerifyUrl}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="send-amount">{t('send.amount')}</Label>
                    {flow.secondaryDisplay !== '' && (
                      <span className="text-muted-foreground text-xs leading-none">
                        {flow.secondaryDisplay}
                      </span>
                    )}
                  </div>
                  <Input
                    aria-invalid={flow.insufficientFunds}
                    className={cn(
                      flow.insufficientFunds && 'border-destructive focus-visible:ring-destructive'
                    )}
                    disabled={flow.isAmountLocked}
                    endAddOn={
                      <AmountUnitToggle
                        canToggle={flow.canUseFiat}
                        disabled={flow.isAmountLocked}
                        entryMode={flow.entryMode}
                        onToggle={flow.toggleAmountMode}
                        unitLabel={flow.unitLabel}
                      />
                    }
                    id="send-amount"
                    onChange={(e) => flow.setAmount(e.target.value)}
                    placeholder="0"
                    type="text"
                    value={flow.amountDisplay}
                  />
                  {flow.insufficientFunds && (
                    <p className="text-destructive text-xs">
                      {t('send.errors.insufficient_funds', {
                        balance: formatBitcoin(flow.availableBalance)
                      })}
                    </p>
                  )}
                  {flow.usesPendingOnchain && (
                    <p className="text-muted-foreground text-xs">
                      {t('send.warnings.uses_pending_onchain')}
                    </p>
                  )}
                  <span className="text-muted-foreground text-xs leading-none">
                    {t('send.fee.estimate')}: {flow.feeDisplay}
                    {flow.feeSat !== undefined && flow.feeSat > 0 && (
                      <> • {formatFiat(flow.feeSat)}</>
                    )}
                  </span>
                </div>
                {flow.isOnchainDestination && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="send-source">{t('send.pay_from')}</Label>
                    <Select
                      onValueChange={(value) => {
                        if (value === 'onchain-from-ark' || value === 'onchain-from-wallet') {
                          flow.setSendRoute(value)
                        }
                      }}
                      value={flow.sendRoute}
                    >
                      <SelectTrigger className="w-full" id="send-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onchain-from-ark">
                          {t('send.pay_from_ark')} • {formatBitcoin(flow.arkBalanceSat)}
                        </SelectItem>
                        <SelectItem value="onchain-from-wallet">
                          {t('send.pay_from_onchain')} •{' '}
                          {formatBitcoin(flow.onchainTrustedSpendableSat)}
                          {flow.onchainPendingTotalSat > 0 && (
                            <>
                              {' + '}
                              {formatBitcoin(flow.onchainPendingTotalSat)} {t('send.pending')}
                            </>
                          )}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Label className="group flex items-center justify-between">
                      {t('send.details')}
                      <CaretDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                    </Label>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-4 pt-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="send-label">{t('send.label')}</Label>
                      <Input
                        id="send-label"
                        onChange={(e) => flow.setLabel(e.target.value)}
                        placeholder={t('send.label_placeholder')}
                        type="text"
                        value={flow.label}
                      />
                    </div>
                    {isLnAddress && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="send-message">{t('send.message')}</Label>
                        <Input
                          id="send-message"
                          onChange={(e) => flow.setMessage(e.target.value)}
                          placeholder={t('send.message_placeholder')}
                          type="text"
                          value={flow.message}
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Label>{t('tags.label')}</Label>
                      <TagInput onChange={flow.setSelectedTags} value={flow.selectedTags} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </ModalBody>
              <ModalFooter>
                {flow.isScanSupported && (
                  <Button onClick={flow.goToScan} variant="outline">
                    <ScanIcon />
                    {t('send.scan_qr')}
                  </Button>
                )}
                <Button
                  disabled={!flow.canSend}
                  loading={flow.isSending}
                  onClick={flow.handleConfirmSend}
                >
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
