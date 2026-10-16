import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function FallbackDestinationSettings() {
  const { t } = useTranslation()
  const query = useQuery({
    queryFn: async () => await walletApi.fallbackDestination(),
    queryKey: walletKeys.fallbackDestination(),
    retry: false,
    refetchOnWindowFocus: false
  })
  return (
    <Field>
      <FieldLabel htmlFor="fallback-destination">{t('settings.fallback_destination.label')}</FieldLabel>
      <Input id="fallback-destination" readOnly value={query.isSuccess ? query.data : ''} />
      <FieldDescription>{t('settings.fallback_destination.description')}</FieldDescription>
      {query.isPending && <p role="status">{t('settings.fallback_destination.loading')}</p>}
      {query.isError && (
        <div role="status">
          <p>{t('settings.fallback_destination.unavailable')}</p>
          <Button onClick={() => { void query.refetch() }} size="sm" variant="outline">
            {t('settings.fallback_destination.retry')}
          </Button>
        </div>
      )}
    </Field>
  )
}
