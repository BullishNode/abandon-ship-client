import { CoinsIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { useSweepExpiryPayouts } from '@/hooks/barkd/use-sweep-expiry-payouts'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { backendErrorMessage } from '@/lib/error-message'

// Expired coins the server paid out on-chain sit at their own keys, outside the
// on-chain wallet, until they are swept into it.
export function ExpiryPayoutNote() {
  const { t } = useTranslation()
  const { sats: formatBitcoin } = usePrivateAmount()
  const { payouts, payingOutSat, isPayoutError, refreshPayouts } = useExpiredVtxos()
  const { mutate: sweep, isPending } = useSweepExpiryPayouts({
    onError: async (error) => {
      const description = await backendErrorMessage(error)
      toast.error(t('expiry_payout.sweep.error'), { description })
    },
    onSuccess: ({ sweptSats }) => {
      toast.success(t('expiry_payout.sweep.success', { amount: formatBitcoin(sweptSats) }))
    }
  })
  const hasPayout = payouts.length > 0
  if (!hasPayout && !isPayoutError) {
    return null
  }
  return (
    <Alert className="mb-6" role="status">
      <CoinsIcon />
      <AlertTitle>
        {hasPayout
          ? t('expiry_payout.title', { amount: formatBitcoin(payingOutSat) })
          : t('expiry_payout.unavailable_title')}
      </AlertTitle>
      <AlertDescription>
        <p>
          {t(hasPayout ? 'expiry_payout.description' : 'expiry_payout.unavailable_description')}
        </p>
        {isPayoutError ? (
          <>
            {hasPayout ? <p>{t('expiry_payout.stale')}</p> : null}
            <Button onClick={refreshPayouts} size="sm" variant="outline">
              {t('expiry_payout.retry')}
            </Button>
          </>
        ) : (
          <Button
            aria-label={t(isPending ? 'expiry_payout.sweep.pending' : 'expiry_payout.sweep.button')}
            aria-busy={isPending}
            loading={isPending}
            onClick={() => {
              sweep()
            }}
            size="sm"
            variant="outline"
          >
            {t('expiry_payout.sweep.button')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
