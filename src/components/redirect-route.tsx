import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from '@/components/loading-screen'
import { useCheckWallet } from '@/hooks/barkd/use-check-wallet'

export function RedirectRoute() {
  const { t } = useTranslation()
  const { data: walletExists, isPending } = useCheckWallet({ staleTime: 0 })
  const location = useLocation()

  const isOnboarding = location.pathname === '/create' || location.pathname === '/import'
  const isDashboard = location.pathname.startsWith('/dashboard')

  if (isPending) {
    return <LoadingScreen text={t('welcome.loading')} />
  }

  if (isOnboarding) {
    return <Outlet />
  }

  if (walletExists === true && !isDashboard) {
    return <Navigate replace to="/dashboard" />
  }

  if (walletExists !== true && isDashboard) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
