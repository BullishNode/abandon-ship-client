import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useFallbackRegistration } from '@/hooks/barkd/use-fallback-registration'
import { useVtxos } from '@/hooks/barkd/use-vtxos'

export function FallbackExpiryNotice() {
  const { t } = useTranslation()
  const { data: registration } = useFallbackRegistration()
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()
  if (
    __BACKEND__ === 'wasm' ||
    !registration?.registered ||
    tip === undefined ||
    !vtxos?.some((vtxo) => vtxo.state.type === 'spendable' && vtxo.expiryHeight <= tip + 144)
  ) {
    return null
  }
  return (
    <Alert>
      <AlertDescription>{t('fallback.expiry_notice')}</AlertDescription>
    </Alert>
  )
}
