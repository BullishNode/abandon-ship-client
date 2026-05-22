import { CaretDownIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CopyAddressButton } from '@/components/copy-address-button'
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from '@/components/modal'
import { QRCode } from '@/components/qr-code'
import { TagInput } from '@/components/tag-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { useReceiveFlow } from '@/hooks/use-receive-flow'
import { cn } from '@/lib/utils'

interface ReceiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReceiveModal({ open, onOpenChange }: ReceiveModalProps) {
  const { t } = useTranslation()
  const formatFiat = useFormatFiat()
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
      </ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <Tabs onValueChange={flow.handleTabChange} value={flow.activeTab}>
          <TabsList className="w-full">
            <TabsTrigger value="payto">{t('receive.tabs.payto')}</TabsTrigger>
            <TabsTrigger value="ark">{t('receive.tabs.ark')}</TabsTrigger>
            <TabsTrigger value="lightning">{t('receive.tabs.lightning')}</TabsTrigger>
            <TabsTrigger value="onchain">{t('receive.tabs.onchain')}</TabsTrigger>
          </TabsList>
          <TabsContent value="payto">
            <PaytoTab
              hasArk={flow.hasArk}
              hasLightning={flow.hasInvoice}
              hasOnchain={flow.hasOnchain}
              isLoading={flow.isFetchingArkAddress || flow.isFetchingOnchainAddress}
              uri={flow.paytoUri}
            />
          </TabsContent>
          <TabsContent value="ark">
            <AddressTab address={flow.arkAddress} isLoading={flow.isFetchingArkAddress} />
          </TabsContent>
          <TabsContent value="lightning">
            <LightningTab invoice={flow.lightningInvoice} />
          </TabsContent>
          <TabsContent value="onchain">
            <AddressTab address={flow.onchainAddress} isLoading={flow.isFetchingOnchainAddress} />
          </TabsContent>
        </Tabs>
        <div className="flex flex-col gap-4">
          {flow.showAmountField && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="receive-amount">{t('amount.label')}</Label>
                {flow.validAmount !== undefined && (
                  <span className="text-muted-foreground text-xs">
                    {formatFiat(flow.validAmount)}
                  </span>
                )}
              </div>
              <Input
                endTextAddOn={t('bitcoin.sats_unit_other')}
                id="receive-amount"
                onChange={(e) => flow.setAmount(e.target.value)}
                placeholder="0"
                type="text"
                value={flow.amountDisplay}
              />
              {flow.activeTab === 'payto' && flow.needsAmount && (
                <p className="text-muted-foreground text-xs">{t('receive.payto.needs_amount')}</p>
              )}
            </div>
          )}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Label className="group flex items-center justify-between">
                {t('receive.details')}
                <CaretDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
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
  hasArk: boolean
  hasOnchain: boolean
  hasLightning: boolean
}

function PaytoTab({ uri, isLoading, hasArk, hasOnchain, hasLightning }: PaytoTabProps) {
  const { t } = useTranslation()
  const hasUri = uri !== undefined && uri !== ''
  const showError = !isLoading && !hasUri

  return (
    <div className="flex flex-col items-center gap-0 py-4">
      <div className="flex aspect-square w-80 items-center justify-center">
        {isLoading && <span className="text-muted-foreground text-sm">Loading...</span>}
        {!isLoading && hasUri && <QRCode value={uri} />}
        {showError && (
          <span className="text-destructive text-center text-sm">{t('receive.payto.error')}</span>
        )}
      </div>
      <NetworkPills hasArk={hasArk} hasLightning={hasLightning} hasOnchain={hasOnchain} />
      {hasUri ? <CopyAddressButton text={uri} /> : <div aria-hidden className="h-9 w-full" />}
    </div>
  )
}

interface NetworkPillsProps {
  hasArk: boolean
  hasOnchain: boolean
  hasLightning: boolean
}

function NetworkPills({ hasArk, hasOnchain, hasLightning }: NetworkPillsProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
      <NetworkPill label={t('receive.tabs.ark')} lit={hasArk} />
      <NetworkPill label={t('receive.tabs.onchain')} lit={hasOnchain} />
      <NetworkPill label={t('receive.tabs.lightning')} lit={hasLightning} />
    </div>
  )
}

interface NetworkPillProps {
  label: string
  lit: boolean
}

function NetworkPill({ label, lit }: NetworkPillProps) {
  return (
    <Badge variant="outline">
      <span
        className={cn(
          'size-2 rounded-full',
          lit ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/40'
        )}
      />
      {label}
    </Badge>
  )
}

interface LightningTabProps {
  invoice: string | undefined
}

function LightningTab({ invoice }: LightningTabProps) {
  const { t } = useTranslation()

  const hasInvoice = invoice !== undefined && invoice !== ''

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
