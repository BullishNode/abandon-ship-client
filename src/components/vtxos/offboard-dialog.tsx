import type { WalletVtxoInfo } from '@secondts/barkd'
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
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { useOffboardFlow } from '@/hooks/use-offboard-flow'

interface OffboardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vtxos: WalletVtxoInfo[]
  onOffboarded: () => void
}

export function OffboardDialog({ open, onOpenChange, vtxos, onOffboarded }: OffboardDialogProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const formatFiat = useFormatFiat()
  const flow = useOffboardFlow({ onOffboarded, onOpenChange, open, vtxos })

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    flow.submit()
  }

  return (
    <Dialog onOpenChange={flow.close} open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('vtxos.offboard.title', { count: flow.count })}</DialogTitle>
            <DialogDescription>
              {t('vtxos.offboard.description', {
                amount: formatBitcoin(flow.totalSat),
                count: flow.count
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4">
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="offboard-address">
                  {t('vtxos.offboard.address_label')}
                </FieldLabel>
                <Button
                  className="text-muted-foreground no-underline hover:text-foreground hover:no-underline"
                  disabled={flow.isPending || flow.isFetchingWalletAddress}
                  loading={flow.isFetchingWalletAddress}
                  onClick={flow.fillWalletAddress}
                  size="xs"
                  type="button"
                  variant="link"
                >
                  {t('vtxos.offboard.use_wallet_address')}
                </Button>
              </div>
              <Input
                autoComplete="off"
                disabled={flow.isPending}
                id="offboard-address"
                onChange={(event) => flow.setAddress(event.target.value)}
                spellCheck={false}
                value={flow.address}
              />
              {(flow.feeSat !== undefined || flow.isFetchingFee) && (
                <span className="text-muted-foreground text-xs leading-none">
                  {t('vtxos.offboard.fee_estimate')}:{' '}
                  {flow.feeSat === undefined ? '…' : formatBitcoin(flow.feeSat)}
                  {flow.feeSat !== undefined && flow.feeSat > 0 && (
                    <> • {formatFiat(flow.feeSat)}</>
                  )}
                </span>
              )}
              <FieldDescription className="text-xs">
                {t('vtxos.offboard.fee_note')}
              </FieldDescription>
            </Field>
          </div>
          <DialogFooter className="mt-6">
            <Button
              disabled={flow.isPending}
              onClick={() => flow.close(false)}
              type="button"
              variant="outline"
            >
              {t('vtxos.offboard.cancel')}
            </Button>
            <Button loading={flow.isPending} type="submit">
              {t('vtxos.offboard.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
