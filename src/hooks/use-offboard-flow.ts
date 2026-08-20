import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useOffboardFee } from '@/hooks/barkd/use-offboard-fee'
import { useOffboardVtxos } from '@/hooks/barkd/use-offboard-vtxos'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useDebounce } from '@/hooks/use-debounce'
import { backendErrorMessage } from '@/lib/error-message'
import { config } from '@/config/runtime'
import type { Vtxo } from '@/types/domain/vtxo'
import { isValidOnchainAddress } from '@/utils/bitcoin'
import { sumVtxoAmount } from '@/utils/vtxo'

const FEE_DEBOUNCE_MS = 500

interface UseOffboardFlowOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  vtxos: Vtxo[]
  onOffboarded: () => void
}

export function useOffboardFlow({
  open,
  onOpenChange,
  vtxos,
  onOffboarded
}: UseOffboardFlowOptions) {
  const { t } = useTranslation()
  const [address, setAddress] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setAddress('')
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const vtxoIds = vtxos.map((vtxo) => vtxo.id)
  const trimmedAddress = address.trim()
  const isAddressInvalid =
    trimmedAddress !== '' && !isValidOnchainAddress(trimmedAddress, config.network)
  const debouncedAddress = useDebounce(trimmedAddress, FEE_DEBOUNCE_MS)
  const shouldEstimateFee = open && trimmedAddress !== '' && !isAddressInvalid
  // The debounced address lags the input, so it can still hold a superseded
  // (possibly invalid) address. Only query once it matches the input.
  const isFeeForCurrentAddress = debouncedAddress === trimmedAddress
  const {
    data: offboardFee,
    isError: isFeeQueryError,
    refetch: refetchOffboardFee
  } = useOffboardFee(
    shouldEstimateFee && isFeeForCurrentAddress ? debouncedAddress : undefined,
    vtxoIds
  )
  const isFeeCurrent = offboardFee !== undefined && isFeeForCurrentAddress
  // A failed refetch keeps the previous estimate, and an error left over from a
  // superseded address says nothing about the address on screen. Only surface
  // the error when there is no usable estimate for the current input.
  const isFeeError = shouldEstimateFee && isFeeQueryError && isFeeForCurrentAddress && !isFeeCurrent

  const { mutate: offboard, isPending } = useOffboardVtxos({
    onError: async (error) => {
      const description = await backendErrorMessage(error)
      toast.error(t('vtxos.offboard.error'), { description })
    },
    onSuccess: () => {
      toast.success(t('vtxos.offboard.success'))
      onOffboarded()
      onOpenChange(false)
    }
  })

  const { mutate: fetchOnchainAddress, isPending: isFetchingWalletAddress } = useOnchainAddress()

  // An empty address offboards to the wallet's own address with no quote to
  // wait for. An entered address needs a fee estimate for its current value,
  // or the user submits against a stale or absent quote.
  const canSubmit = !isPending && (trimmedAddress === '' || (!isAddressInvalid && isFeeCurrent))

  function fillWalletAddress() {
    fetchOnchainAddress(undefined, {
      onSuccess: (walletAddress) => {
        setAddress(walletAddress)
      }
    })
  }

  function close(nextOpen: boolean) {
    if (isPending) {
      return
    }
    onOpenChange(nextOpen)
  }

  function submit() {
    if (!canSubmit) {
      return
    }
    offboard({
      address: trimmedAddress === '' ? undefined : trimmedAddress,
      vtxos: vtxoIds
    })
  }

  return {
    address,
    canSubmit,
    close,
    count: vtxos.length,
    feeSat: isFeeCurrent ? offboardFee.feeSats : undefined,
    fillWalletAddress,
    isAddressInvalid,
    isFeeError,
    isFetchingFee: shouldEstimateFee && !isFeeCurrent && !isFeeError,
    isFetchingWalletAddress,
    isPending,
    retryFeeEstimate: () => {
      // refetch bypasses `enabled`, so never retry a superseded address
      if (!isFeeForCurrentAddress) {
        return
      }
      void refetchOffboardFee()
    },
    setAddress,
    submit,
    totalSat: sumVtxoAmount(vtxos)
  }
}
