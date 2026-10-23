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
  const exited = receipt.disposition === 'exited'
  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <AlertDescription>
          {exited && receipt.stage === 'awaiting_settlement'
            ? t('fallback.exit_pending')
            : t(`fallback.stage.${receipt.stage}`)}
        </AlertDescription>
      </Alert>
      {!exited && (
        <DetailRow label={t('fallback.payout_amount')} value={formatSats(receipt.payout_sat)} />
      )}
      {receipt.forfeited_sat > 0 && (
        <DetailRow label={t('fallback.dust_amount')} value={formatSats(receipt.forfeited_sat)} />
      )}
      {receipt.txid !== null && (
        <CopyableValueRow
          label={t(exited ? 'fallback.claim_transaction' : 'fallback.transaction')}
          value={receipt.txid}
        />
      )}
      {!exited && <p className="text-muted-foreground text-sm">{t('fallback.miner_fee')}</p>}
    </div>
  )
}
