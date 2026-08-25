import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullScreenLayout } from '@/components/full-screen-layout'
import { LoadingScreen } from '@/components/loading-screen'
import { Button } from '@/components/ui/button'
import { useCheckWallet } from '@/hooks/barkd/use-check-wallet'

const ONBOARDING_PATHS = new Set(['/create', '/import'])

export function RedirectRoute() {
  const { t } = useTranslation()
  const { data: walletExists, isError, isPending, refetch } = useCheckWallet({ staleTime: 0 })
  const location = useLocation()

  const isOnboarding = ONBOARDING_PATHS.has(location.pathname)
  const isDashboard = location.pathname.startsWith('/dashboard')

  if (isPending) {
    return <LoadingScreen text={t('welcome.loading')} />
  }

  // Without knowing whether a wallet exists, onboarding could create a second
  // wallet over an existing one, so never fall through to a route on error.
  if (isError) {
    return (
      <FullScreenLayout>
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-muted-foreground text-sm">{t('welcome.error')}</p>
          <Button onClick={() => void refetch()} type="button" variant="outline">
            {t('welcome.retry')}
          </Button>
        </div>
      </FullScreenLayout>
    )
  }

  // Must precede the onboarding branch: /create and /import would otherwise
  // create a second wallet over the existing one.
  if (walletExists && !isDashboard) {
    return <Navigate replace to="/dashboard" />
  }

  if (isOnboarding) {
    return <Outlet />
  }

  if (!walletExists && isDashboard) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
