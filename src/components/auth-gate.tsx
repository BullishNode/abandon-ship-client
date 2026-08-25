import type { ReactNode } from 'react'
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

  if (authRequired && !authed) {
    return passwordConfigured ? <LoginPage /> : <SetupPasswordPage />
  }

  return children
}
