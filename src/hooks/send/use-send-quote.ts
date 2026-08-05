import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useSendOnchainFee } from '@/hooks/barkd/use-send-onchain-fee'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useAmountInput } from '@/hooks/use-amount-input'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import type { SendRoute } from '@/utils/payment'

interface UseSendQuoteOptions {
  open: boolean
  sendRoute: SendRoute
  destination: string
  hasValidDestination: boolean
}

export function useSendQuote({
  open,
  sendRoute,
  destination,
  hasValidDestination
}: UseSendQuoteOptions) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()

  const amountInput = useAmountInput()
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    amountInput.reset()
    setPrevOpen(open)
  }

  const { validAmountSat } = amountInput

  const isLightningRoute = sendRoute === 'lightning'
  const isOnchainRoute = sendRoute === 'onchain-from-ark' || sendRoute === 'onchain-from-wallet'

  const { data: lightningSendFee, isFetching: isFetchingLnFee } = useLightningSendFee(
    isLightningRoute && hasValidDestination ? validAmountSat : undefined
  )
  const { data: onchainSendFee, isFetching: isFetchingOnchainFee } = useSendOnchainFee(
    isOnchainRoute ? validAmountSat : undefined,
    isOnchainRoute ? destination : undefined
  )

  let feeEstimate: { feeSats: number; grossAmountSats?: number } | undefined
  let isFetchingFee = false
  if (sendRoute === 'ark') {
    feeEstimate = { feeSats: 0 }
  } else if (isLightningRoute) {
    feeEstimate = lightningSendFee
    isFetchingFee = isFetchingLnFee
  } else {
    feeEstimate = onchainSendFee
    isFetchingFee = isFetchingOnchainFee
  }

  let feeDisplay = '—'
  if (sendRoute === 'ark') {
    feeDisplay = t('send.fee.free')
  } else if (isFetchingFee) {
    feeDisplay = '...'
  } else if (feeEstimate) {
    feeDisplay = formatBitcoin(feeEstimate.feeSats)
  }
  const feeSat = sendRoute === 'ark' ? undefined : feeEstimate?.feeSats

  const { data: walletBalance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()

  const arkBalanceSat = walletBalance?.spendableSats ?? 0
  const onchainTrustedSpendableSat = onchainBalance?.trustedSpendableSats ?? 0
  const onchainTrustedPendingSat = onchainBalance?.trustedPendingSats ?? 0
  const onchainUntrustedPendingSat = onchainBalance?.untrustedPendingSats ?? 0
  const onchainPendingTotalSat = onchainTrustedPendingSat + onchainUntrustedPendingSat
  const onchainBalanceSat = onchainTrustedSpendableSat + onchainPendingTotalSat
  const availableBalance = sendRoute === 'onchain-from-wallet' ? onchainBalanceSat : arkBalanceSat

  const requiredSat =
    validAmountSat === undefined
      ? undefined
      : (feeEstimate?.grossAmountSats ?? validAmountSat + (feeEstimate?.feeSats ?? 0))

  const hasEnoughFunds = requiredSat === undefined ? true : availableBalance >= requiredSat
  const insufficientFunds = requiredSat !== undefined && !hasEnoughFunds
  const usesPendingOnchain =
    sendRoute === 'onchain-from-wallet' &&
    requiredSat !== undefined &&
    hasEnoughFunds &&
    requiredSat > onchainTrustedSpendableSat

  return {
    amount: amountInput.amount,
    amountDisplay: amountInput.amountDisplay,
    arkBalanceSat,
    availableBalance,
    canUseFiat: amountInput.canUseFiat,
    entryMode: amountInput.entryMode,
    feeDisplay,
    feeSat,
    hasEnoughFunds,
    insufficientFunds,
    isFetchingFee,
    onchainBalanceSat,
    onchainPendingTotalSat,
    onchainTrustedSpendableSat,
    secondaryDisplay: amountInput.secondaryDisplay,
    setAmount: amountInput.setAmount,
    setAmountSat: amountInput.setAmountSat,
    toggleAmountMode: amountInput.toggleMode,
    unitLabel: amountInput.unitLabel,
    usesPendingOnchain,
    validAmountSat
  }
}
