import type { WalletVtxoInfo } from '@secondts/barkd'
import { useState } from 'react'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useOnchainFeeRates } from '@/hooks/barkd/use-onchain-fee-rates'
import { useStartEmergencyExitVtxos } from '@/hooks/barkd/use-start-emergency-exit-vtxos'
import { useWalletStore } from '@/stores/wallet'
import type { EmergencyExitFeeEstimate } from '@/components/emergency-exit-start-dialog'
import { estimateEmergencyExitFeeSat } from '@/utils/exit-progress'

interface UseEmergencyExitVtxosOptions {
  onStarted: () => void
  isExitingAll: boolean
}

export function useEmergencyExitVtxos(
  vtxos: WalletVtxoInfo[],
  { onStarted, isExitingAll }: UseEmergencyExitVtxosOptions
) {
  const [address, setAddress] = useState('')
  const setExitClaimAddresses = useWalletStore((state) => state.setExitClaimAddresses)
  const setIsEmergencyExitAllInProgress = useWalletStore(
    (state) => state.setIsEmergencyExitAllInProgress
  )
  const { data: feeRates } = useOnchainFeeRates()
  const { data: onchainBalance } = useOnchainBalance()
  const { mutate: fetchOnchainAddress, isPending: isFetchingWalletAddress } = useOnchainAddress()
  const {
    mutate: startEmergencyExit,
    isPending: isStarting,
    error: startError
  } = useStartEmergencyExitVtxos({ onSuccess: onStarted })

  const feeRateSatPerVb = feeRates?.regularSatPerVb ?? 0
  const onchainSat = onchainBalance?.trustedSpendableSat ?? 0

  const feeEstimate: EmergencyExitFeeEstimate | undefined =
    vtxos.length > 0 && feeRateSatPerVb > 0
      ? {
          estimatedFeeSat: estimateEmergencyExitFeeSat(vtxos, feeRateSatPerVb),
          feeRateSatPerVb,
          onchainSat,
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
    const vtxoIds = vtxos.map((vtxo) => vtxo.id)
    setExitClaimAddresses(vtxoIds, submittedAddress)
    if (isExitingAll) {
      setIsEmergencyExitAllInProgress(true)
    }
    startEmergencyExit(vtxoIds)
  }

  return {
    address,
    errorMessage: startError?.message,
    feeEstimate,
    handleSubmit,
    handleUseWalletAddress,
    isFetchingWalletAddress,
    isStarting,
    setAddress
  }
}
