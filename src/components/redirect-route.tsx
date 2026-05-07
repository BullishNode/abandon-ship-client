import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { useCheckWallet } from '@/hooks/barkd/use-check-wallet'

export function RedirectRoute() {
  const { data: walletExists, isPending } = useCheckWallet({ staleTime: 0 })
  const location = useLocation()

  const isOnboarding = location.pathname === '/create' || location.pathname === '/import'
  const isDashboard = location.pathname.startsWith('/dashboard')

  if (isPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
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
