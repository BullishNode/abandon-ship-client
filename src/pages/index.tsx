import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAutoCreateWallet } from '@/hooks/barkd/use-auto-create-wallet'
import { useCheckWallet } from '@/hooks/barkd/use-check-wallet'

// Both backends auto-create silently. barkd is safe because the daemon
// persists the seed. WASM is safe only because the auto-create flow verifies
// the mnemonic decrypts back out of the device vault before the wallet counts
// as created — when the browser cannot persist that vault (some private
// modes), it reports 'unsupported' and we route through the explicit create
// flow, which displays and confirms the 12 words instead.
export default function IndexPage() {
  const { t } = useTranslation()
  const { data: walletExists } = useCheckWallet({ staleTime: 0 })
  const { data: outcome, error } = useAutoCreateWallet({
    enabled: walletExists === false
  })

  if (outcome === 'unsupported') {
    return <Navigate replace to="/create" />
  }

  if (error) {
    return (
      <Card className="min-w-sm shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">{t('welcome.title')}</CardTitle>
          <CardDescription className="text-pretty text-center text-destructive text-lg">
            {error.message}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const isCreating = walletExists === false
  return (
    <div className="flex flex-col items-center gap-4">
      <Spinner className="size-8" />
      <p className="text-muted-foreground text-sm">
        {t(isCreating ? 'welcome.setting_up' : 'welcome.loading')}
      </p>
    </div>
  )
}
