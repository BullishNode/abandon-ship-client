import { useTranslation } from 'react-i18next'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAutoCreateWallet } from '@/hooks/barkd/use-auto-create-wallet'
import { useCheckWallet } from '@/hooks/barkd/use-check-wallet'

export default function IndexPage() {
  const { t } = useTranslation()
  const { data: walletExists } = useCheckWallet({ staleTime: 0 })
  const { error } = useAutoCreateWallet({ enabled: walletExists === false })

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
