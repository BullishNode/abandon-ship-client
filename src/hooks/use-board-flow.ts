import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBoardAll } from '@/hooks/barkd/use-board-all'
import { useBoardAmount } from '@/hooks/barkd/use-board-amount'
import { useBoardFee } from '@/hooks/barkd/use-board-fee'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useAmountInput } from '@/hooks/use-amount-input'
import { useDebounce } from '@/hooks/use-debounce'
import { backendErrorMessage } from '@/lib/error-message'
import { validateBoardAmount } from '@/utils/board'

const FEE_DEBOUNCE_MS = 500

interface UseBoardFlowOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function useBoardFlow({ open, onOpenChange }: UseBoardFlowOptions) {
  const { t } = useTranslation()
  const amountInput = useAmountInput()
  const [isMax, setIsMax] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    amountInput.reset()
    setIsMax(false)
    setPrevOpen(open)
  }

  const { data: onchainBalance } = useOnchainBalance()
  const { data: arkInfo } = useArkInfo()
  const onchainSpendableSat = onchainBalance?.trustedSpendableSats ?? 0
  const minBoardAmountSat = arkInfo?.minBoardAmountSats

  const { validAmountSat } = amountInput
  const debouncedAmountSat = useDebounce(validAmountSat, FEE_DEBOUNCE_MS)
  const localValidation = validateBoardAmount(
    validAmountSat,
    onchainSpendableSat,
    minBoardAmountSat
  )
  const shouldEstimateFee = localValidation === 'valid'
  const {
    data: boardFee,
    isError: isFeeQueryError,
    refetch: refetchBoardFee
  } = useBoardFee(shouldEstimateFee ? debouncedAmountSat : undefined)
  const isFeeForCurrentAmount = debouncedAmountSat === validAmountSat
  const isFeeCurrent = boardFee !== undefined && isFeeForCurrentAmount
  // A failed refetch keeps the previous estimate, and an error left over from a
  // superseded amount says nothing about the amount on screen. Only surface the
  // error when there is no usable estimate for the current input.
  const isFeeError = shouldEstimateFee && isFeeQueryError && isFeeForCurrentAmount && !isFeeCurrent
  const validation = validateBoardAmount(
    validAmountSat,
    onchainSpendableSat,
    minBoardAmountSat,
    isFeeCurrent ? boardFee.netAmountSats : undefined
  )

  const mutationCallbacks = {
    onError: async (error: Error) => {
      const description = await backendErrorMessage(error)
      toast.error(t('board.toast.error'), { description })
    },
    onSuccess: () => {
      toast.success(t('board.toast.started'))
      onOpenChange(false)
    }
  }
  const { mutate: boardAmount, isPending: isBoardingAmount } = useBoardAmount(mutationCallbacks)
  const { mutate: boardAll, isPending: isBoardingAll } = useBoardAll(mutationCallbacks)
  const isBoarding = isBoardingAmount || isBoardingAll

  // The dust check needs the fee-adjusted net amount, so the submit gate must
  // wait for a fee estimate that matches the current input.
  const canSubmit = validation === 'valid' && isFeeCurrent && !isBoarding

  function setAmount(value: string) {
    setIsMax(false)
    amountInput.setAmount(value)
  }

  function setMax() {
    if (onchainSpendableSat <= 0) {
      return
    }
    setIsMax(true)
    amountInput.setAmountSat(onchainSpendableSat)
  }

  function submit() {
    if (!canSubmit || validAmountSat === undefined) {
      return
    }
    if (isMax || validAmountSat === onchainSpendableSat) {
      boardAll()
      return
    }
    boardAmount({ amountSat: validAmountSat })
  }

  return {
    amountDisplay: amountInput.amountDisplay,
    canSubmit,
    canUseFiat: amountInput.canUseFiat,
    entryMode: amountInput.entryMode,
    feeSat: isFeeCurrent ? boardFee.feeSats : undefined,
    hasOnchainFunds: onchainSpendableSat > 0,
    isBoarding,
    isFeeError,
    isFetchingFee: shouldEstimateFee && !isFeeCurrent && !isFeeError,
    minBoardAmountSat,
    onchainSpendableSat,
    retryFeeEstimate: () => {
      void refetchBoardFee()
    },
    secondaryDisplay: amountInput.secondaryDisplay,
    setAmount,
    setMax,
    submit,
    toggleAmountMode: amountInput.toggleMode,
    unitLabel: amountInput.unitLabel,
    validation
  }
}
