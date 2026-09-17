import type { ReactNode } from 'react'
import AuthTokenPage from '@/pages/auth-token'
import LoginPage from '@/pages/login'
import SetupPasswordPage from '@/pages/setup-password'
import { useAuthStore } from '@/stores/auth'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps): ReactNode {
  const authRequired = useAuthStore((state) => state.authRequired)
  const authed = useAuthStore((state) => state.authed)
  const passwordConfigured = useAuthStore((state) => state.passwordConfigured)
  const tokenRequired = useAuthStore((state) => state.tokenRequired)

  if (tokenRequired) {
    return <AuthTokenPage />
  }

  if (authRequired && !authed) {
    return passwordConfigured ? <LoginPage /> : <SetupPasswordPage />
  }

  return children
}
