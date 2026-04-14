import { CaretDownIcon, PaperPlaneTiltIcon, QrCodeIcon, ScanIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
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
import { SendModal } from '@/components/send-modal'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWalletAddress } from '@/hooks/barkd/use-wallet-address'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useSettingsStore } from '@/stores/settings'
import { formatCurrency } from '@/utils/format'

type ReceiveTab = 'payto' | 'ark' | 'lightning' | 'onchain'

const PLACEHOLDER_ADDRESSES: Record<ReceiveTab, string> = {
  ark: '',
  lightning:
    'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql',
  onchain: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  payto: 'payto://bitcoin/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlhblabhasdlabhasdg'
}

export default function DashboardLayout() {
  const { t } = useTranslation()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendInitialStep, setSendInitialStep] = useState<'scan' | 'send'>('scan')
  const [activeTab, setActiveTab] = useState<ReceiveTab>('payto')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [tags, setTags] = useState('')
  const [contact, setContact] = useState('')
  const { data: btcPrice } = useBitcoinPrice()
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)
  const {
    mutate: fetchArkAddress,
    data: arkAddress,
    isPending: isFetchingArkAddress
  } = useWalletAddress()

  function handleTabChange(value: string) {
    if (value === 'payto' || value === 'ark' || value === 'lightning' || value === 'onchain') {
      setActiveTab(value)
    }
  }

  function handleOpenReceiveModal() {
    fetchArkAddress()
    setShowReceiveModal(true)
  }

  function handleNewAddress() {
    fetchArkAddress()
  }

  const currentAddress = activeTab === 'ark' ? (arkAddress ?? '') : PLACEHOLDER_ADDRESSES[activeTab]

  const formattedPrice =
    btcPrice?.currentPrice !== undefined && btcPrice.currentPrice !== 0
      ? formatCurrency(btcPrice.currentPrice, fiatCurrency)
      : '—'

  const isArkTab = activeTab === 'ark'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              className="mt-2 mr-2 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            <h3>Current route name</h3>
          </div>
          <ul className="flex gap-2 pr-4">
            <li className="flex items-center gap-2 pr-4">
              <span className="font-medium">BTC</span>
              <span className="text-muted-foreground tabular-nums">{formattedPrice}</span>
            </li>
            <li>
              <Button
                onClick={() => {
                  setSendInitialStep('scan')
                  setShowSendModal(true)
                }}
                variant="outline"
              >
                <ScanIcon />
                {t('actions.scan')}
              </Button>
            </li>
            <li>
              <Button onClick={handleOpenReceiveModal}>
                <QrCodeIcon />
                {t('actions.receive')}
              </Button>
            </li>
            <li>
              <Button
                onClick={() => {
                  setSendInitialStep('send')
                  setShowSendModal(true)
                }}
              >
                <PaperPlaneTiltIcon />
                {t('actions.send')}
              </Button>
            </li>
          </ul>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <Modal setShowModal={setShowReceiveModal} showModal={showReceiveModal}>
          <ModalHeader>
            <ModalTitle>{t('actions.receive')}</ModalTitle>
            <ModalDescription>
              Scan the QR code or copy the address to receive funds.
            </ModalDescription>
          </ModalHeader>
          <ModalBody className="flex flex-col gap-6">
            <Tabs onValueChange={handleTabChange} value={activeTab}>
              <TabsList className="w-full">
                <TabsTrigger value="payto">Pay to</TabsTrigger>
                <TabsTrigger value="ark">Ark</TabsTrigger>
                <TabsTrigger value="lightning">Lightning</TabsTrigger>
                <TabsTrigger value="onchain">On-chain</TabsTrigger>
              </TabsList>
              <TabsContent value="payto">
                <div className="flex flex-col items-center gap-4 py-4">
                  <QRCode value={currentAddress} />
                  <CopyAddressButton text={currentAddress} />
                </div>
              </TabsContent>
              <TabsContent value="ark">
                <ArkAddressTab address={arkAddress} isLoading={isFetchingArkAddress} />
              </TabsContent>
              <TabsContent value="lightning">
                <div className="flex flex-col items-center gap-4 py-4">
                  <QRCode value={currentAddress} />
                  <CopyAddressButton text={currentAddress} />
                </div>
              </TabsContent>
              <TabsContent value="onchain">
                <div className="flex flex-col items-center gap-4 py-4">
                  <QRCode value={currentAddress} />
                  <CopyAddressButton text={currentAddress} />
                </div>
              </TabsContent>
            </Tabs>
            {!isArkTab && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="amount">Amount (optional)</Label>
                  <Input
                    id="amount"
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    type="text"
                    value={amount}
                  />
                </div>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Label className="flex items-center justify-between">
                      Additional details
                      <CaretDownIcon className="size-4" />
                    </Label>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-4 pt-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="label">Label</Label>
                      <Input
                        id="label"
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Enter a label"
                        type="text"
                        value={label}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="tags">Tags</Label>
                      <Input
                        id="tags"
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="Enter tags"
                        type="text"
                        value={tags}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="contact">Contact</Label>
                      <Input
                        id="contact"
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Enter contact"
                        type="text"
                        value={contact}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowReceiveModal(false)} variant="outline">
              {t('actions.cancel')}
            </Button>
            <Button loading={isFetchingArkAddress} onClick={handleNewAddress}>
              {t('receive.new')}
            </Button>
          </ModalFooter>
        </Modal>
        <SendModal
          initialStep={sendInitialStep}
          onOpenChange={setShowSendModal}
          open={showSendModal}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}

interface ArkAddressTabProps {
  address: string | undefined
  isLoading: boolean
}

function ArkAddressTab({ address, isLoading }: ArkAddressTabProps) {
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
