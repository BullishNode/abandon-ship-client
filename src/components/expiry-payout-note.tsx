import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'

export function ExpiryPayoutNote() {
  const { t } = useTranslation()
  const { isStatusError, retryStatus } = useExpiredVtxos()
  if (!isStatusError) {
    return null
  }
  return (
    <Alert className="mb-6" role="status">
      <AlertTitle>{t('expiry_status.unavailable_title')}</AlertTitle>
      <AlertDescription>
        <p>{t('expiry_status.unavailable_description')}</p>
        <Button onClick={retryStatus} size="sm" variant="outline">
          {t('expiry_status.retry')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
