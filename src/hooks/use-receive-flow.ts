import { encodeBIP321 } from 'bip-321'
import { useEffect, useState } from 'react'
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

export type ReceiveTab = 'payto' | 'ark' | 'lightning' | 'onchain'

interface UseReceiveFlowOptions {
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

function collectReceiveDestinations(
  arkAddress: string | undefined,
  onchainAddress: string | undefined,
  lightningInvoice: string | undefined
): string[] {
  const values: string[] = []
  if (arkAddress !== undefined && arkAddress !== '') {
    values.push(arkAddress)
  }
  if (onchainAddress !== undefined && onchainAddress !== '') {
    values.push(onchainAddress)
  }
  if (lightningInvoice !== undefined && lightningInvoice !== '') {
    values.push(lightningInvoice)
  }
  return values
}

export function useReceiveFlow({ open, onOpenChange }: UseReceiveFlowOptions) {
  const formatBitcoin = useFormatBitcoin()
  const upsertBinding = useMetadataStore((state) => state.upsertBinding)

  const [activeTab, setActiveTab] = useState<ReceiveTab>('payto')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [receivedAmountSat, setReceivedAmountSat] = useState<number | undefined>()
  const [bindingId, setBindingId] = useState<string | undefined>()
  const [prevOpen, setPrevOpen] = useState(open)

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
    enabled: debouncedAmount !== undefined
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
    setBindingId(undefined)
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

  const trimmedLabel = label.trim()
  const hasMetadata = trimmedLabel !== '' || selectedTags.length > 0

  useEffect(() => {
    if (!open || !hasMetadata) {
      return
    }
    const destinations = collectReceiveDestinations(arkAddress, onchainAddress, lightningInvoice)
    if (destinations.length === 0) {
      return
    }
    const id = upsertBinding({
      destinations,
      direction: 'incoming',
      id: bindingId,
      label: trimmedLabel === '' ? undefined : trimmedLabel,
      tags: selectedTags
    })
    if (id !== bindingId) {
      setBindingId(id)
    }
  }, [
    open,
    hasMetadata,
    arkAddress,
    onchainAddress,
    lightningInvoice,
    trimmedLabel,
    selectedTags,
    bindingId,
    upsertBinding
  ])

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

  function handleNewAddress() {
    if (activeTab === 'ark') {
      fetchArkAddress()
      return
    }
    if (activeTab === 'lightning') {
      handleGenerateInvoice()
      return
    }
    if (activeTab === 'onchain') {
      fetchOnchainAddress()
      return
    }
    fetchArkAddress()
    fetchOnchainAddress()
    if (validAmount !== undefined) {
      handleGenerateInvoice()
    }
  }

  function handleClose() {
    onOpenChange(false)
  }

  const isLoading = getLoadingForTab(
    activeTab,
    isFetchingArkAddress,
    isGeneratingInvoice,
    isFetchingOnchainAddress
  )
  const showAmountField = activeTab !== 'ark'
  const hasInvoice = lightningInvoice !== undefined && lightningInvoice !== ''
  const needsAmount = !hasInvoice && validAmount === undefined
  const feeDisplay = receiveFee ? formatBitcoin(receiveFee.feeSat) : undefined

  return {
    activeTab,
    amount,
    arkAddress,
    feeDisplay,
    handleClose,
    handleNewAddress,
    handleTabChange,
    isFetchingArkAddress,
    isFetchingOnchainAddress,
    isLoading,
    label,
    lightningInvoice,
    needsAmount,
    onchainAddress,
    paytoUri,
    receivedAmountSat,
    selectedTags,
    setAmount,
    setLabel,
    setSelectedTags,
    showAmountField
  }
}
