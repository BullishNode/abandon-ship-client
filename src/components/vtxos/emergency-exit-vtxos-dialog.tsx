import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmergencyExitStartDialog } from '@/components/emergency-exit-start-dialog'
import { useEmergencyExitVtxos } from '@/hooks/use-emergency-exit-vtxos'
import type { Vtxo } from '@/types/domain/vtxo'

interface EmergencyExitVtxosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vtxos: Vtxo[]
  isExitingAll: boolean
  onStarted: () => void
}

export function EmergencyExitVtxosDialog({
  open,
  onOpenChange,
  vtxos,
  isExitingAll,
  onStarted
}: EmergencyExitVtxosDialogProps) {
  const { t } = useTranslation()
  const [prevOpen, setPrevOpen] = useState(open)
  const flow = useEmergencyExitVtxos(vtxos, {
    isExitingAll,
    onStarted: () => {
      onStarted()
      onOpenChange(false)
    }
  })

  if (open && !prevOpen) {
    flow.setAddress('')
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  function handleClose(nextOpen: boolean) {
    if (flow.isStarting) {
      return
    }
    onOpenChange(nextOpen)
  }

  const count = vtxos.length
  return (
    <EmergencyExitStartDialog
      address={flow.address}
      description={t('vtxos.emergency_exit.description')}
      errorMessage={flow.errorMessage}
      feeEstimate={flow.feeEstimate}
      isFetchingWalletAddress={flow.isFetchingWalletAddress}
      isSubmitting={flow.isStarting}
      mode="start"
      onAddressChange={flow.setAddress}
      onOpenChange={handleClose}
      onSubmit={flow.handleSubmit}
      onUseWalletAddress={flow.handleUseWalletAddress}
      open={open}
      submitLabel={t('vtxos.emergency_exit.confirm')}
      title={t('vtxos.emergency_exit.title', { count })}
    />
  )
}
