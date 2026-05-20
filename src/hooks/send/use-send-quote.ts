import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useSendOnchainFee } from '@/hooks/barkd/use-send-onchain-fee'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { formatSatsDisplay, parseSatsInput } from '@/utils/format'
import type { SendRoute } from '@/utils/payment'

interface UseSendQuoteOptions {
  open: boolean
  sendRoute: SendRoute
  destination: string
}

export function useSendQuote({ open, sendRoute, destination }: UseSendQuoteOptions) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()

  const [amount, setAmount] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setAmount('')
  }

  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const amountSat = Number.parseInt(amount, 10)
  const validAmountSat = Number.isNaN(amountSat) || amountSat <= 0 ? undefined : amountSat
  const amountDisplay = formatSatsDisplay(amount)

  function handleAmountChange(value: string) {
    setAmount(parseSatsInput(value))
  }

  const isLightningRoute = sendRoute === 'lightning'
  const isOnchainRoute = sendRoute === 'onchain-from-ark' || sendRoute === 'onchain-from-wallet'

  const { data: lightningSendFee, isFetching: isFetchingLnFee } = useLightningSendFee(
    isLightningRoute ? validAmountSat : undefined
  )
  const { data: onchainSendFee, isFetching: isFetchingOnchainFee } = useSendOnchainFee(
    isOnchainRoute ? validAmountSat : undefined,
    isOnchainRoute ? destination : undefined
  )

  let feeEstimate: { feeSat: number; grossAmountSat?: number } | undefined
  let isFetchingFee = false
  if (sendRoute === 'ark') {
    feeEstimate = { feeSat: 0 }
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
    feeDisplay = formatBitcoin(feeEstimate.feeSat)
  }
  const feeSat = sendRoute === 'ark' ? undefined : feeEstimate?.feeSat

  const { data: walletBalance } = useWalletBalance()
  const { data: onchainBalance } = useOnchainBalance()

  const arkBalanceSat = walletBalance?.spendableSat ?? 0
  const onchainTrustedSpendableSat = onchainBalance?.trustedSpendableSat ?? 0
  const onchainTrustedPendingSat = onchainBalance?.trustedPendingSat ?? 0
  const onchainUntrustedPendingSat = onchainBalance?.untrustedPendingSat ?? 0
  const onchainPendingTotalSat = onchainTrustedPendingSat + onchainUntrustedPendingSat
  const onchainBalanceSat = onchainTrustedSpendableSat + onchainPendingTotalSat
  const availableBalance = sendRoute === 'onchain-from-wallet' ? onchainBalanceSat : arkBalanceSat

  const requiredSat =
    validAmountSat === undefined
      ? undefined
      : (feeEstimate?.grossAmountSat ?? validAmountSat + (feeEstimate?.feeSat ?? 0))

  const hasEnoughFunds = requiredSat === undefined ? true : availableBalance >= requiredSat
  const insufficientFunds = requiredSat !== undefined && !hasEnoughFunds
  const usesPendingOnchain =
    sendRoute === 'onchain-from-wallet' &&
    requiredSat !== undefined &&
    hasEnoughFunds &&
    requiredSat > onchainTrustedSpendableSat

  return {
    amount,
    amountDisplay,
    arkBalanceSat,
    availableBalance,
    feeDisplay,
    feeSat,
    hasEnoughFunds,
    insufficientFunds,
    isFetchingFee,
    onchainBalanceSat,
    onchainPendingTotalSat,
    onchainTrustedSpendableSat,
    setAmount: handleAmountChange,
    usesPendingOnchain,
    validAmountSat
  }
}
