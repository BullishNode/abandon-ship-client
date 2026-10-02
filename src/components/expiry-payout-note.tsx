import { CoinsIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { useSweepExpiryPayouts } from '@/hooks/barkd/use-sweep-expiry-payouts'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { backendErrorMessage } from '@/lib/error-message'

// Expired coins the server paid out on-chain sit at their own keys, outside the
// on-chain wallet, until they are swept into it.
export function ExpiryPayoutNote() {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const { payouts } = useExpiredVtxos()
  const { mutate: sweep, isPending } = useSweepExpiryPayouts({
    onError: async (error) => {
      const description = await backendErrorMessage(error)
      toast.error(t('expiry_payout.sweep.error'), { description })
    },
    onSuccess: ({ sweptSats }) => {
      toast.success(t('expiry_payout.sweep.success', { amount: formatBitcoin(sweptSats) }))
    }
  })
  if (payouts.length === 0) {
    return null
  }
  const amountSats = payouts.reduce((total, payout) => total + payout.amountSats, 0)
  return (
    <Alert className="mb-6">
      <CoinsIcon />
      <AlertTitle>
        {t('expiry_payout.title', { amount: formatBitcoin(amountSats), count: payouts.length })}
      </AlertTitle>
      <AlertDescription>
        <p>{t('expiry_payout.description')}</p>
        <Button
          loading={isPending}
          onClick={() => sweep({ vtxoIds: payouts.map((payout) => payout.vtxoId) })}
          size="sm"
          variant="outline"
        >
          {t('expiry_payout.sweep.button')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
