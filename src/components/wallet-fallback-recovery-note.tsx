import { CoinsIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { config } from '@/config/runtime'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { useOnchainTransactions } from '@/hooks/barkd/use-onchain-transactions'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { walletFallbackApi } from '@/lib/backend/barkd/wallet-fallback'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { receiptsAtFallbackAddress } from '@/utils/wallet-fallback-receipts'

const destinationKey = [...walletKeys.all, 'fallback-destination'] as const

export function WalletFallbackRecoveryNote() {
  const { t } = useTranslation()
  const { sats: formatBitcoin } = usePrivateAmount()
  const client = useQueryClient()
  const { recoveryUnknownIds, isChecked, hasExpiredCoins } = useExpiredVtxos()
  const { data: transactions } = useOnchainTransactions()
  const { data: tip } = useBitcoinTip()
  const destination = useQuery({
    queryKey: destinationKey,
    queryFn: async () => await walletFallbackApi.destination(),
    refetchInterval: 30_000,
    retry: false
  })
  const observation = useMemo(() => {
    if (destination.data === undefined || transactions === undefined || tip === undefined) return undefined
    try {
      return receiptsAtFallbackAddress(destination.data.address, config.network, transactions, tip)
    } catch {
      return undefined
    }
  }, [destination.data, transactions, tip])
  const refresh = useMutation({
    mutationFn: async () => await walletFallbackApi.sync(),
    onSuccess: async () => {
      await Promise.all([
        invalidateMovementState(client),
        client.invalidateQueries({ queryKey: destinationKey }),
        client.invalidateQueries({ queryKey: walletKeys.expiredVtxosAll() })
      ])
    },
    onError: () => toast.error(t('wallet_recovery.refresh_failed'))
  })
  const unknownCount = recoveryUnknownIds?.size ?? 0
  const amount = observation?.totalSats ?? 0
  const incomplete = !isChecked || destination.isError || observation === undefined || observation.invalidTransactionIds.length > 0
  // Missing details must never hide known recovery rights. A normal wallet with
  // no expired work does not need a recovery warning for an unrelated fetch error.
  if (unknownCount === 0 && amount === 0 && !(hasExpiredCoins === true && !isChecked)) return null
  return (
    <Alert className="mb-6" role="status">
      <CoinsIcon />
      <AlertTitle>{t('wallet_recovery.title')}</AlertTitle>
      <AlertDescription>
        <p>{t('wallet_recovery.description')}</p>
        {unknownCount > 0 ? <p>{t('wallet_recovery.unknown', { count: unknownCount })}</p> : null}
        {amount > 0 ? <p>{t('wallet_recovery.received', { amount: formatBitcoin(amount) })}</p> : null}
        <p>{t('wallet_recovery.limits')}</p>
        {incomplete ? <p>{t('wallet_recovery.incomplete')}</p> : null}
        <Button onClick={() => refresh.mutate()} loading={refresh.isPending} disabled={refresh.isPending} size="sm" variant="outline">
          {t('wallet_recovery.refresh')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
