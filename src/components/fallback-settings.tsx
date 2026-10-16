import { useTranslation } from 'react-i18next'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { useFallbackRegistration } from '@/hooks/barkd/use-fallback-registration'

export function FallbackSettings() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useFallbackRegistration()
  if (__BACKEND__ === 'wasm') {
    return null
  }
  let status = data?.registered ? 'registered' : 'unregistered'
  if (isError) {
    status = 'unavailable'
  }
  if (isPending) {
    status = 'loading'
  }
  return (
    <Field>
      <FieldLabel>{t('fallback.title')}</FieldLabel>
      <p role="status">{t(`fallback.${status}`)}</p>
      {data?.registered && !isError && (
        <code className="break-all select-all text-sm">{data.payout_address}</code>
      )}
      <FieldDescription>{t('fallback.description')}</FieldDescription>
    </Field>
  )
}
