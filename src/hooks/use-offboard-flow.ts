import type { WalletVtxoInfo } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useOffboardFee } from '@/hooks/barkd/use-offboard-fee'
import { useOffboardVtxos } from '@/hooks/barkd/use-offboard-vtxos'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useDebounce } from '@/hooks/use-debounce'
import { barkdErrorMessage } from '@/lib/barkd-errors'
import { sumVtxoAmount } from '@/utils/vtxo'

const FEE_DEBOUNCE_MS = 500

interface UseOffboardFlowOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  vtxos: WalletVtxoInfo[]
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
  const debouncedAddress = useDebounce(trimmedAddress, FEE_DEBOUNCE_MS)
  const shouldEstimateFee = open && trimmedAddress !== ''
  const { data: offboardFee, isError: isFeeError } = useOffboardFee(
    shouldEstimateFee && debouncedAddress !== '' ? debouncedAddress : undefined,
    vtxoIds
  )
  const isFeeCurrent = offboardFee !== undefined && debouncedAddress === trimmedAddress

  const { mutate: offboard, isPending } = useOffboardVtxos({
    onError: async (error) => {
      const description = await barkdErrorMessage(error)
      toast.error(t('vtxos.offboard.error'), { description })
    },
    onSuccess: () => {
      toast.success(t('vtxos.offboard.success'))
      onOffboarded()
      onOpenChange(false)
    }
  })

  const { mutate: fetchOnchainAddress, isPending: isFetchingWalletAddress } = useOnchainAddress()

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
    if (isPending) {
      return
    }
    offboard({
      address: trimmedAddress === '' ? undefined : trimmedAddress,
      vtxos: vtxoIds
    })
  }

  return {
    address,
    close,
    count: vtxos.length,
    feeSat: isFeeCurrent ? offboardFee.feeSat : undefined,
    fillWalletAddress,
    isFetchingFee: shouldEstimateFee && !(isFeeCurrent || isFeeError),
    isFetchingWalletAddress,
    isPending,
    setAddress,
    submit,
    totalSat: sumVtxoAmount(vtxos)
  }
}
