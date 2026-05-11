import { CaretDownIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CopyAddressButton } from '@/components/copy-address-button'
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle
} from '@/components/modal'
import { QRCode } from '@/components/qr-code'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useReceiveFlow } from '@/hooks/use-receive-flow'

interface ReceiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReceiveModal({ open, onOpenChange }: ReceiveModalProps) {
  const { t } = useTranslation()
  const flow = useReceiveFlow({ onOpenChange, open })

  if (flow.receivedAmountSat !== undefined) {
    return (
      <Modal onClose={flow.handleClose} setShowModal={onOpenChange} showModal={open}>
        <ReceivedSuccessView amountSat={flow.receivedAmountSat} />
      </Modal>
    )
  }

  return (
    <Modal onClose={flow.handleClose} setShowModal={onOpenChange} showModal={open}>
      <ModalHeader>
        <ModalTitle>{t('receive.title')}</ModalTitle>
        <ModalDescription>{t('receive.description')}</ModalDescription>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-6">
        <Tabs onValueChange={flow.handleTabChange} value={flow.activeTab}>
          <TabsList className="w-full">
            <TabsTrigger value="payto">{t('receive.tabs.payto')}</TabsTrigger>
            <TabsTrigger value="ark">{t('receive.tabs.ark')}</TabsTrigger>
            <TabsTrigger value="lightning">{t('receive.tabs.lightning')}</TabsTrigger>
            <TabsTrigger value="onchain">{t('receive.tabs.onchain')}</TabsTrigger>
          </TabsList>
          <TabsContent value="payto">
            <PaytoTab
              isLoading={flow.isFetchingArkAddress || flow.isFetchingOnchainAddress}
              needsAmount={flow.needsAmount}
              uri={flow.paytoUri}
            />
          </TabsContent>
          <TabsContent value="ark">
            <AddressTab address={flow.arkAddress} isLoading={flow.isFetchingArkAddress} />
          </TabsContent>
          <TabsContent value="lightning">
            <LightningTab feeDisplay={flow.feeDisplay} invoice={flow.lightningInvoice} />
          </TabsContent>
          <TabsContent value="onchain">
            <AddressTab address={flow.onchainAddress} isLoading={flow.isFetchingOnchainAddress} />
          </TabsContent>
        </Tabs>
        <div className="flex flex-col gap-4">
          {flow.showAmountField && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="receive-amount">{t('amount.label')}</Label>
              <Input
                endTextAddOn={t('bitcoin.sats_unit_other')}
                id="receive-amount"
                onChange={(e) => flow.setAmount(e.target.value)}
                placeholder="0"
                type="text"
                value={flow.amount}
              />
            </div>
          )}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Label className="flex items-center justify-between">
                {t('receive.details')}
                <CaretDownIcon className="size-4" />
              </Label>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="receive-label">{t('label.label')}</Label>
                <Input
                  id="receive-label"
                  onChange={(e) => flow.setLabel(e.target.value)}
                  placeholder={t('send.label.placeholder')}
                  type="text"
                  value={flow.label}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('tags.label')}</Label>
                <TagInput onChange={flow.setSelectedTags} value={flow.selectedTags} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onClick={flow.handleClose} variant="outline">
          {t('actions.cancel')}
        </Button>
        <Button loading={flow.isLoading} onClick={flow.handleNewAddress}>
          {t('receive.new')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

interface AddressTabProps {
  address: string | undefined
  isLoading: boolean
}

function AddressTab({ address, isLoading }: AddressTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-4">
        <div className="flex aspect-square w-75 items-center justify-center">
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (address === undefined || address === '') {
    return (
      <div className="flex flex-col items-center py-4">
        <div className="flex aspect-square w-75 items-center justify-center">
          <span className="text-muted-foreground text-sm">No address available</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <QRCode value={address} />
      <CopyAddressButton text={address} />
    </div>
  )
}

interface PaytoTabProps {
  uri: string | undefined
  isLoading: boolean
  needsAmount: boolean
}

function PaytoTab({ uri, isLoading, needsAmount }: PaytoTabProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-4">
        <div className="flex aspect-square w-75 items-center justify-center">
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  const hasUri = uri !== undefined && uri !== ''

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {hasUri ? (
        <>
          <QRCode value={uri} />
          <CopyAddressButton text={uri} />
        </>
      ) : (
        <div className="flex aspect-square w-75 items-center justify-center">
          <span className="text-muted-foreground text-sm">{t('receive.payto.description')}</span>
        </div>
      )}
      {needsAmount && (
        <p className="text-muted-foreground text-center text-xs">
          {t('receive.payto.needs_amount')}
        </p>
      )}
    </div>
  )
}

interface LightningTabProps {
  invoice: string | undefined
  feeDisplay: string | undefined
}

function LightningTab({ invoice, feeDisplay }: LightningTabProps) {
  const { t } = useTranslation()

  const hasInvoice = invoice !== undefined && invoice !== ''
  const hasFee = feeDisplay !== undefined && feeDisplay !== ''

  if (!hasInvoice) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex aspect-square w-75 items-center justify-center">
          <span className="text-muted-foreground text-center text-sm">
            {t('receive.lightning.needs_amount')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <QRCode value={invoice} />
      <CopyAddressButton text={invoice} />
      {hasFee && (
        <p className="text-muted-foreground text-xs">
          {t('receive.lightning.fee')}: {feeDisplay}
        </p>
      )}
    </div>
  )
}

interface ReceivedSuccessViewProps {
  amountSat: number
}

function ReceivedSuccessView({ amountSat }: ReceivedSuccessViewProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()

  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <m.div
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.6 }}
        transition={{ damping: 14, stiffness: 240, type: 'spring' }}
      >
        <CheckCircleIcon className="size-20 text-foreground" weight="fill" />
      </m.div>
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-1"
        initial={{ opacity: 0, y: 8 }}
        transition={{ delay: 0.1, duration: 0.2 }}
      >
        <span className="font-medium text-lg">{t('receive.success.title')}</span>
        <span className="text-muted-foreground tabular-nums">{formatBitcoin(amountSat)}</span>
      </m.div>
    </div>
  )
}
