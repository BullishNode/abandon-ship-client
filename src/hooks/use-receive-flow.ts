import { useQueryClient } from '@tanstack/react-query'
import { encodeBIP321 } from 'bip-321'
import { useEffect, useRef, useState } from 'react'
import { useLightningInvoice } from '@/hooks/barkd/use-lightning-invoice'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useReceivedOnchainPayment } from '@/hooks/barkd/use-received-onchain-payment'
import { useReceivedPayment } from '@/hooks/barkd/use-received-payment'
import { useWalletAddress } from '@/hooks/barkd/use-wallet-address'
import { useDebounce } from '@/hooks/use-debounce'
import { lightningKeys } from '@/lib/query-keys'
import { useMetadataStore } from '@/stores/metadata'
import { formatSatsDisplay, parseSatsInput } from '@/utils/format'

const INVOICE_DEBOUNCE_MS = 500
const RECEIVED_AUTO_CLOSE_MS = 3000

export type ReceiveTab = 'payto' | 'ark' | 'lightning' | 'onchain'

export interface ReceivedPayment {
  amountSat: number
  rail: 'offchain' | 'onchain'
  pending: boolean
}

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
  const upsertBinding = useMetadataStore((state) => state.upsertBinding)
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<ReceiveTab>('payto')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [received, setReceived] = useState<ReceivedPayment | undefined>()
  const bindingIdRef = useRef<string | null>(null)
  const [prevOpen, setPrevOpen] = useState(open)

  const amountSat = Number.parseInt(amount, 10)
  const validAmount = Number.isNaN(amountSat) || amountSat <= 0 ? undefined : amountSat
  const amountDisplay = formatSatsDisplay(amount)
  const debouncedAmount = useDebounce(validAmount, INVOICE_DEBOUNCE_MS)
  const debouncedAmountBtc = debouncedAmount === undefined ? undefined : debouncedAmount / 1e8

  function handleAmountChange(value: string) {
    setAmount(parseSatsInput(value))
  }

  const {
    mutate: fetchArkAddress,
    data: arkAddress,
    isPending: isFetchingArkAddress
  } = useWalletAddress()

  const {
    data: lightningInvoiceData,
    isFetching: isGeneratingInvoice,
    isPlaceholderData: isInvoicePlaceholder,
    refetch: regenerateInvoice
  } = useLightningInvoice({
    amountSat: debouncedAmount,
    enabled: debouncedAmount !== undefined
  })
  const lightningInvoice = validAmount === undefined ? undefined : lightningInvoiceData

  const [paired, setPaired] = useState<{
    amountBtc: number | undefined
    invoice: string | undefined
  }>({ amountBtc: undefined, invoice: undefined })

  if (
    validAmount === undefined &&
    (paired.amountBtc !== undefined || paired.invoice !== undefined)
  ) {
    setPaired({ amountBtc: undefined, invoice: undefined })
  }

  const hasFreshInvoice =
    validAmount !== undefined &&
    debouncedAmount !== undefined &&
    !isGeneratingInvoice &&
    !isInvoicePlaceholder &&
    lightningInvoiceData !== undefined
  if (
    hasFreshInvoice &&
    (paired.amountBtc !== debouncedAmountBtc || paired.invoice !== lightningInvoiceData)
  ) {
    setPaired({ amountBtc: debouncedAmountBtc, invoice: lightningInvoiceData })
  }

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
    setReceived(undefined)
    bindingIdRef.current = null
    queryClient.removeQueries({ queryKey: lightningKeys.all })
    fetchArkAddress()
    fetchOnchainAddress()
  }

  function handleReceived(payment: ReceivedPayment) {
    if (!open || received !== undefined) {
      return
    }
    setReceived(payment)
    window.setTimeout(() => {
      onOpenChange(false)
    }, RECEIVED_AUTO_CLOSE_MS)
  }

  useReceivedPayment(
    (movement) => {
      handleReceived({
        amountSat: movement.effectiveBalanceSat,
        pending: false,
        rail: 'offchain'
      })
    },
    { enabled: open }
  )

  useReceivedOnchainPayment(
    (payment) => {
      handleReceived({ amountSat: payment.amountSat, pending: payment.pending, rail: 'onchain' })
    },
    { enabled: open }
  )

  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const paytoUri = buildPaytoUri(onchainAddress, arkAddress, paired.invoice, paired.amountBtc)

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
      id: bindingIdRef.current ?? undefined,
      label: trimmedLabel === '' ? undefined : trimmedLabel,
      tags: selectedTags
    })
    bindingIdRef.current = id
  }, [
    open,
    hasMetadata,
    arkAddress,
    onchainAddress,
    lightningInvoice,
    trimmedLabel,
    selectedTags,
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
  const showAmountField = activeTab === 'payto' || activeTab === 'lightning'
  const hasArk = arkAddress !== undefined && arkAddress !== ''
  const hasOnchain = onchainAddress !== undefined && onchainAddress !== ''
  const hasInvoice = lightningInvoice !== undefined && lightningInvoice !== ''
  const needsAmount = !hasInvoice && validAmount === undefined

  return {
    activeTab,
    amount,
    amountDisplay,
    arkAddress,
    handleClose,
    handleNewAddress,
    handleTabChange,
    hasArk,
    hasInvoice,
    hasOnchain,
    isFetchingArkAddress,
    isFetchingOnchainAddress,
    isLoading,
    label,
    lightningInvoice,
    needsAmount,
    onchainAddress,
    paytoUri,
    received,
    selectedTags,
    setAmount: handleAmountChange,
    setLabel,
    setSelectedTags,
    showAmountField,
    validAmount
  }
}
