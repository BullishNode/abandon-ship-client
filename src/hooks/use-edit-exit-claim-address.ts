import { useState } from 'react'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useWalletStore } from '@/stores/wallet'

interface UseEditExitClaimAddressOptions {
  onSaved: () => void
}

export function useEditExitClaimAddress(
  vtxoId: string,
  { onSaved }: UseEditExitClaimAddressOptions
) {
  const [address, setAddress] = useState('')
  const storedAddress = useWalletStore((state) => state.exitClaimAddresses[vtxoId])
  const setExitClaimAddresses = useWalletStore((state) => state.setExitClaimAddresses)
  const { mutate: fetchOnchainAddress, isPending: isFetchingWalletAddress } = useOnchainAddress()

  function handleUseWalletAddress() {
    fetchOnchainAddress(undefined, {
      onSuccess: (walletAddress) => {
        setAddress(walletAddress)
      }
    })
  }

  function handleSubmit(submittedAddress: string) {
    setExitClaimAddresses([vtxoId], submittedAddress)
    onSaved()
  }

  return {
    address,
    handleSubmit,
    handleUseWalletAddress,
    isFetchingWalletAddress,
    setAddress,
    storedAddress
  }
}
