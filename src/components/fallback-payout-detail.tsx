import { useTranslation } from 'react-i18next'
import { CopyableValueRow, DetailRow } from '@/components/movement-detail-shared'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Movement } from '@/types/domain/movement'
import { fallbackReceipt } from '@/utils/fallback'

export function FallbackPayoutDetail({
  movement,
  formatSats
}: {
  movement: Movement
  formatSats: (value: number) => string
}) {
  const { t } = useTranslation()
  const receipt = fallbackReceipt(movement)
  if (receipt === null) {
    return null
  }
  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <AlertDescription>{t(`fallback.stage.${receipt.stage}`)}</AlertDescription>
      </Alert>
      <DetailRow label={t('fallback.payout_amount')} value={formatSats(receipt.payout_sat)} />
      {receipt.forfeited_sat > 0 && (
        <DetailRow label={t('fallback.dust_amount')} value={formatSats(receipt.forfeited_sat)} />
      )}
      {receipt.txid !== null && (
        <CopyableValueRow label={t('fallback.transaction')} value={receipt.txid} />
      )}
      <p className="text-muted-foreground text-sm">{t('fallback.miner_fee')}</p>
    </div>
  )
}
