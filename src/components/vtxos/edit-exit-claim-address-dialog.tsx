import { useState } from 'react'
import { EmergencyExitStartDialog } from '@/components/emergency-exit-start-dialog'
import { useEditExitClaimAddress } from '@/hooks/use-edit-exit-claim-address'

interface EditExitClaimAddressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vtxoId: string
}

export function EditExitClaimAddressDialog({
  open,
  onOpenChange,
  vtxoId
}: EditExitClaimAddressDialogProps) {
  const [prevOpen, setPrevOpen] = useState(open)
  const flow = useEditExitClaimAddress(vtxoId, {
    onSaved: () => {
      onOpenChange(false)
    }
  })
  if (open && !prevOpen) {
    flow.setAddress(flow.storedAddress ?? '')
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }
  return (
    <EmergencyExitStartDialog
      address={flow.address}
      isFetchingWalletAddress={flow.isFetchingWalletAddress}
      isSubmitting={false}
      mode="edit"
      onAddressChange={flow.setAddress}
      onOpenChange={onOpenChange}
      onSubmit={flow.handleSubmit}
      onUseWalletAddress={flow.handleUseWalletAddress}
      open={open}
    />
  )
}
