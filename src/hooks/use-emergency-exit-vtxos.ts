import { useState } from 'react'
import { config } from '@/config/runtime'
import { useEmergencyExitFee } from '@/hooks/barkd/use-emergency-exit-fee'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useStartEmergencyExitVtxos } from '@/hooks/barkd/use-start-emergency-exit-vtxos'
import { backendErrorMessage } from '@/lib/error-message'
import { useWalletStore } from '@/stores/wallet'
import type { EmergencyExitFeeEstimate } from '@/components/emergency-exit-start-dialog'
import type { Vtxo } from '@/types/domain/vtxo'
import { isValidOnchainAddress } from '@/utils/bitcoin'

interface UseEmergencyExitVtxosOptions {
  onStarted: () => void
  isExitingAll: boolean
  isOpen: boolean
}

export function useEmergencyExitVtxos(
  vtxos: Vtxo[],
  { onStarted, isExitingAll, isOpen }: UseEmergencyExitVtxosOptions
) {
  const [address, setAddress] = useState('')
  const [errorMessage, setErrorMessage] = useState<string>()
  const setExitClaimAddresses = useWalletStore((state) => state.setExitClaimAddresses)
  const setIsEmergencyExitAllInProgress = useWalletStore(
    (state) => state.setIsEmergencyExitAllInProgress
  )
  const { data: onchainBalance } = useOnchainBalance()
  const { mutate: fetchOnchainAddress, isPending: isFetchingWalletAddress } = useOnchainAddress()
  const { mutate: startEmergencyExit, isPending: isStarting } = useStartEmergencyExitVtxos({
    onError: async (error) => {
      setErrorMessage((await backendErrorMessage(error)) ?? error.message)
    }
  })

  const vtxoIds = vtxos.map((vtxo) => vtxo.id)
  const trimmedAddress = address.trim()
  const destination = isValidOnchainAddress(trimmedAddress, config.network)
    ? trimmedAddress
    : undefined
  const { data: estimate } = useEmergencyExitFee(vtxoIds, destination, { enabled: isOpen })

  const feeEstimate: EmergencyExitFeeEstimate | undefined = estimate
    ? {
        estimatedFeeSat: estimate.totalFeeSats,
        feeRateSatPerVb: estimate.feeRateSatPerVb,
        fundable: estimate.fundable,
        onchainSat: onchainBalance?.trustedSpendableSats ?? 0,
        vtxoCount: vtxos.length
      }
    : undefined

  function handleUseWalletAddress() {
    fetchOnchainAddress(undefined, {
      onSuccess: (walletAddress) => {
        setAddress(walletAddress)
      }
    })
  }

  function handleSubmit(submittedAddress: string) {
    setErrorMessage(undefined)
    startEmergencyExit(vtxoIds, {
      onSuccess: () => {
        setExitClaimAddresses(vtxoIds, submittedAddress)
        if (isExitingAll) {
          setIsEmergencyExitAllInProgress(true)
        }
        onStarted()
      }
    })
  }

  return {
    address,
    errorMessage,
    feeEstimate,
    handleSubmit,
    handleUseWalletAddress,
    isFetchingWalletAddress,
    isStarting,
    setAddress
  }
}
