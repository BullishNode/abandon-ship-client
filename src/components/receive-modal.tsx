import { CaretDownIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { encodeBIP321 } from 'bip-321'
import { m } from 'motion/react'
import { useState } from 'react'
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
import { useLightningInvoice } from '@/hooks/barkd/use-lightning-invoice'
import { useLightningReceiveFee } from '@/hooks/barkd/use-lightning-receive-fee'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useReceivedPayment } from '@/hooks/barkd/use-received-payment'
import { useWalletAddress } from '@/hooks/barkd/use-wallet-address'
import { useDebounce } from '@/hooks/use-debounce'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useMetadataStore } from '@/stores/metadata'

const INVOICE_DEBOUNCE_MS = 300
const RECEIVED_AUTO_CLOSE_MS = 1800

type ReceiveTab = 'payto' | 'ark' | 'lightning' | 'onchain'

interface ReceiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function buildPaytoUri(
  onchainAddress: string | undefined,
  arkAddress: string | undefined,
  lightningInvoice: string | undefined,
  amountBtc: number | undefined
): string | undefined {
  const hasOnchain = onchainAddress !== undefined && onchainAddress !== ''
  const hasArk = arkAddress !== undefined && arkAddress !== ''
  if (!hasOnchain && !hasArk) {
    return undefined
  }

  try {
    const result = encodeBIP321({
      address: hasOnchain ? onchainAddress : undefined,
      amount: amountBtc,
      ark: hasArk ? arkAddress : undefined,
      lightning:
        lightningInvoice !== undefined && lightningInvoice !== '' ? lightningInvoice : undefined
    })
    return result.uri
  } catch {
    return undefined
  }
}

function getLoadingForTab(
  activeTab: ReceiveTab,
  isFetchingArkAddress: boolean,
  isGeneratingInvoice: boolean,
  isFetchingOnchainAddress: boolean
): boolean {
  if (activeTab === 'ark') {
    return isFetchingArkAddress
  }
  if (activeTab === 'lightning') {
    return isGeneratingInvoice
  }
  if (activeTab === 'onchain') {
    return isFetchingOnchainAddress
  }
  return isFetchingArkAddress || isFetchingOnchainAddress
}

export function ReceiveModal({ open, onOpenChange }: ReceiveModalProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()

  const [activeTab, setActiveTab] = useState<ReceiveTab>('payto')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [receivedAmountSat, setReceivedAmountSat] = useState<number | undefined>()
  const [prevOpen, setPrevOpen] = useState(open)

  const setAnnotation = useMetadataStore((state) => state.setAnnotation)

  const amountSat = Number.parseInt(amount, 10)
  const validAmount = Number.isNaN(amountSat) || amountSat <= 0 ? undefined : amountSat
  const amountBtc = validAmount === undefined ? undefined : validAmount / 1e8
  const debouncedAmount = useDebounce(validAmount, INVOICE_DEBOUNCE_MS)

  const {
    mutate: fetchArkAddress,
    data: arkAddress,
    isPending: isFetchingArkAddress
  } = useWalletAddress()

  const {
    data: lightningInvoice,
    isFetching: isGeneratingInvoice,
    refetch: regenerateInvoice
  } = useLightningInvoice({
    amountSat: debouncedAmount,
    enabled: activeTab === 'lightning'
  })

  const {
    mutate: fetchOnchainAddress,
    data: onchainAddress,
    isPending: isFetchingOnchainAddress
  } = useOnchainAddress()

  if (open && !prevOpen) {
    setActiveTab('payto')
    setAmount('')
    setLabel('')
    setSelectedTags([])
    setReceivedAmountSat(undefined)
    fetchArkAddress()
    fetchOnchainAddress()
  }

  useReceivedPayment(
    (movement) => {
      if (!open || receivedAmountSat !== undefined) {
        return
      }
      setReceivedAmountSat(movement.effectiveBalanceSat)
      window.setTimeout(() => {
        onOpenChange(false)
      }, RECEIVED_AUTO_CLOSE_MS)
    },
    { enabled: open }
  )

  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const { data: receiveFee } = useLightningReceiveFee(validAmount)

  const paytoUri = buildPaytoUri(onchainAddress, arkAddress, lightningInvoice, amountBtc)

  function handleTabChange(value: string) {
    if (value === 'payto' || value === 'ark' || value === 'lightning' || value === 'onchain') {
      setActiveTab(value)
    }
  }

  function handleGenerateInvoice() {
    if (validAmount === undefined) {
      return
    }
    void regenerateInvoice()
  }

  function saveAnnotation(txKey: string) {
    const hasLabel = label !== ''
    const hasTags = selectedTags.length > 0
    if (!hasLabel && !hasTags) {
      return
    }
    setAnnotation(txKey, {
      label: hasLabel ? label : undefined,
      tags: selectedTags
    })
  }

  function handleNewAddress() {
    if (activeTab === 'ark') {
      fetchArkAddress()
    } else if (activeTab === 'lightning') {
      handleGenerateInvoice()
    } else if (activeTab === 'onchain') {
      fetchOnchainAddress()
    } else {
      fetchArkAddress()
      fetchOnchainAddress()
      if (validAmount !== undefined) {
        handleGenerateInvoice()
      }
    }
  }

  function handleClose() {
    const currentAddress = getCurrentAddress()
    if (currentAddress !== '') {
      saveAnnotation(currentAddress)
    }
    onOpenChange(false)
  }

  function getCurrentAddress(): string {
    if (activeTab === 'ark') {
      return arkAddress ?? ''
    }
    if (activeTab === 'lightning') {
      return lightningInvoice ?? ''
    }
    if (activeTab === 'onchain') {
      return onchainAddress ?? ''
    }
    return paytoUri ?? ''
  }

  const isLoading = getLoadingForTab(
    activeTab,
    isFetchingArkAddress,
    isGeneratingInvoice,
    isFetchingOnchainAddress
  )

  const showAmountField = activeTab !== 'ark'
  const hasInvoice = lightningInvoice !== undefined && lightningInvoice !== ''

  if (receivedAmountSat !== undefined) {
    return (
      <Modal onClose={handleClose} setShowModal={onOpenChange} showModal={open}>
        <ReceivedSuccessView amountSat={receivedAmountSat} />
      </Modal>
    )
  }

  return (
    <Modal onClose={handleClose} setShowModal={onOpenChange} showModal={open}>
      <ModalHeader>
        <ModalTitle>{t('receive.title')}</ModalTitle>
        <ModalDescription>{t('receive.description')}</ModalDescription>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-6">
        <Tabs onValueChange={handleTabChange} value={activeTab}>
          <TabsList className="w-full">
            <TabsTrigger value="payto">{t('receive.tabs.payto')}</TabsTrigger>
            <TabsTrigger value="ark">{t('receive.tabs.ark')}</TabsTrigger>
            <TabsTrigger value="lightning">{t('receive.tabs.lightning')}</TabsTrigger>
            <TabsTrigger value="onchain">{t('receive.tabs.onchain')}</TabsTrigger>
          </TabsList>
          <TabsContent value="payto">
            <PaytoTab
              isLoading={isFetchingArkAddress || isFetchingOnchainAddress}
              needsAmount={!hasInvoice && validAmount === undefined}
              uri={paytoUri}
            />
          </TabsContent>
          <TabsContent value="ark">
            <AddressTab address={arkAddress} isLoading={isFetchingArkAddress} />
          </TabsContent>
          <TabsContent value="lightning">
            <LightningTab
              feeDisplay={receiveFee ? formatBitcoin(receiveFee.feeSat) : undefined}
              invoice={lightningInvoice}
            />
          </TabsContent>
          <TabsContent value="onchain">
            <AddressTab address={onchainAddress} isLoading={isFetchingOnchainAddress} />
          </TabsContent>
        </Tabs>
        {showAmountField && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="receive-amount">{t('amount.label')}</Label>
              <Input
                endTextAddOn={t('bitcoin.sats_unit_other')}
                id="receive-amount"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                type="text"
                value={amount}
              />
            </div>
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
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t('send.label.placeholder')}
                    type="text"
                    value={label}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t('tags.label')}</Label>
                  <TagInput onChange={setSelectedTags} value={selectedTags} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={handleClose} variant="outline">
          {t('actions.cancel')}
        </Button>
        <Button loading={isLoading} onClick={handleNewAddress}>
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
