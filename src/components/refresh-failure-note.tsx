import { WarningIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useRefreshFailuresStore } from '@/stores/refresh-failures'

export function RefreshFailureNote() {
  const { t } = useTranslation()
  const { data: vtxos = [] } = useVtxos()
  const refusedVtxoIds = useRefreshFailuresStore((state) => state.refusedVtxoIds)
  // Only coins the wallet still holds: a refused coin that was later spent or
  // paid out no longer needs a note.
  const refused = new Set(refusedVtxoIds)
  const count = vtxos.filter((vtxo) => refused.has(vtxo.id)).length
  if (count === 0) {
    return null
  }
  return (
    <Alert className="mb-6">
      <WarningIcon />
      <AlertTitle>{t('vtxos.refresh_failure.title', { count })}</AlertTitle>
      <AlertDescription>{t('vtxos.refresh_failure.description')}</AlertDescription>
    </Alert>
  )
}
