import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export interface EmergencyExitFeeEstimate {
  estimatedFeeSat: number
  onchainSat: number
  feeRateSatPerVb: number
  vtxoCount: number
}

interface EmergencyExitStartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'start' | 'edit'
  address: string
  onAddressChange: (address: string) => void
  isSubmitting: boolean
  errorMessage?: string
  feeEstimate?: EmergencyExitFeeEstimate
  isFetchingWalletAddress: boolean
  onUseWalletAddress: () => void
  onSubmit: (address: string) => void
}

export function EmergencyExitStartDialog({
  open,
  onOpenChange,
  mode,
  address,
  onAddressChange,
  isSubmitting,
  errorMessage,
  feeEstimate,
  isFetchingWalletAddress,
  onUseWalletAddress,
  onSubmit
}: EmergencyExitStartDialogProps) {
  const { t } = useTranslation()
  const trimmedAddress = address.trim()
  const isAddressEmpty = trimmedAddress.length === 0

  const showEstimate = mode === 'start' && feeEstimate !== undefined
  const hasInsufficientFunds =
    showEstimate &&
    feeEstimate !== undefined &&
    feeEstimate.onchainSat < feeEstimate.estimatedFeeSat
  const disableSubmit = isAddressEmpty || hasInsufficientFunds

  function handleClose(nextOpen: boolean) {
    if (isSubmitting) {
      return
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disableSubmit) {
      return
    }
    onSubmit(trimmedAddress)
  }

  const titleKey =
    mode === 'start'
      ? 'settings.danger.emergency_exit.confirm.title'
      : 'settings.danger.emergency_exit.edit.title'

  const descriptionKey =
    mode === 'start'
      ? 'settings.danger.emergency_exit.confirm.description'
      : 'settings.danger.emergency_exit.edit.description'

  const submitKey =
    mode === 'start'
      ? 'settings.danger.emergency_exit.confirm.button'
      : 'settings.danger.emergency_exit.edit.button'

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t(titleKey)}</DialogTitle>
            <DialogDescription>{t(descriptionKey)}</DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4">
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="exit-destination-address">
                  {t('settings.danger.emergency_exit.address_label')}
                </FieldLabel>
                <Button
                  className="text-muted-foreground no-underline hover:text-foreground hover:no-underline"
                  disabled={isSubmitting || isFetchingWalletAddress}
                  loading={isFetchingWalletAddress}
                  onClick={onUseWalletAddress}
                  size="xs"
                  type="button"
                  variant="link"
                >
                  {t('settings.danger.emergency_exit.use_wallet_address')}
                </Button>
              </div>
              <Input
                autoComplete="off"
                disabled={isSubmitting}
                id="exit-destination-address"
                onChange={(event) => onAddressChange(event.target.value)}
                placeholder={t('settings.danger.emergency_exit.address_placeholder')}
                spellCheck={false}
                value={address}
              />
              <FieldDescription>
                {t('settings.danger.emergency_exit.address_help')}
              </FieldDescription>
            </Field>
            {showEstimate && feeEstimate !== undefined ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {t('settings.danger.emergency_exit.estimate.title')}
                  </span>
                  <span>
                    {t('settings.danger.emergency_exit.estimate.value', {
                      feeRate: feeEstimate.feeRateSatPerVb,
                      sats: feeEstimate.estimatedFeeSat.toLocaleString()
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    {t('settings.danger.emergency_exit.estimate.vtxos', {
                      count: feeEstimate.vtxoCount
                    })}
                  </span>
                  <span>
                    {t('settings.danger.emergency_exit.estimate.balance', {
                      sats: feeEstimate.onchainSat.toLocaleString()
                    })}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('settings.danger.emergency_exit.estimate.hint')}
                </p>
                {hasInsufficientFunds ? (
                  <p className="font-medium text-destructive text-sm">
                    {t('settings.danger.emergency_exit.estimate.insufficient')}
                  </p>
                ) : null}
              </div>
            ) : null}
            {errorMessage !== undefined && errorMessage.length > 0 ? (
              <p className="text-destructive text-sm">{errorMessage}</p>
            ) : null}
          </div>
          <DialogFooter className="mt-6">
            <Button
              disabled={isSubmitting}
              onClick={() => handleClose(false)}
              type="button"
              variant="outline"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              disabled={disableSubmit}
              loading={isSubmitting}
              type="submit"
              variant={mode === 'start' ? 'destructive' : 'default'}
            >
              {t(submitKey)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
