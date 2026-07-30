import type { WalletVtxoInfo } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { useOffboardVtxos } from '@/hooks/barkd/use-offboard-vtxos'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { barkdErrorMessage } from '@/lib/barkd-errors'
import { sumVtxoAmount } from '@/utils/vtxo'

interface OffboardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vtxos: WalletVtxoInfo[]
  onOffboarded: () => void
}

export function OffboardDialog({ open, onOpenChange, vtxos, onOffboarded }: OffboardDialogProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const [address, setAddress] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)

  if (open && !prevOpen) {
    setAddress('')
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

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

  function handleUseWalletAddress() {
    fetchOnchainAddress(undefined, {
      onSuccess: (walletAddress) => {
        setAddress(walletAddress)
      }
    })
  }

  function handleClose(nextOpen: boolean) {
    if (isPending) {
      return
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedAddress = address.trim()
    offboard({
      address: trimmedAddress === '' ? undefined : trimmedAddress,
      vtxos: vtxos.map((vtxo) => vtxo.id)
    })
  }

  const totalSat = sumVtxoAmount(vtxos)
  const count = vtxos.length

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('vtxos.offboard.title', { count })}</DialogTitle>
            <DialogDescription>
              {t('vtxos.offboard.description', {
                amount: formatBitcoin(totalSat),
                count
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
                  disabled={isPending || isFetchingWalletAddress}
                  loading={isFetchingWalletAddress}
                  onClick={handleUseWalletAddress}
                  size="xs"
                  type="button"
                  variant="link"
                >
                  {t('vtxos.offboard.use_wallet_address')}
                </Button>
              </div>
              <Input
                autoComplete="off"
                disabled={isPending}
                id="offboard-address"
                onChange={(event) => setAddress(event.target.value)}
                spellCheck={false}
                value={address}
              />
              <FieldDescription className="text-xs">
                {t('vtxos.offboard.fee_note')}
              </FieldDescription>
            </Field>
          </div>
          <DialogFooter className="mt-6">
            <Button
              disabled={isPending}
              onClick={() => handleClose(false)}
              type="button"
              variant="outline"
            >
              {t('vtxos.offboard.cancel')}
            </Button>
            <Button loading={isPending} type="submit">
              {t('vtxos.offboard.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
