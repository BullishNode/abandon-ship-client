import type { ReactNode } from 'react'
import LoginPage from '@/pages/login'
import { useAuthStore } from '@/stores/auth'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps): ReactNode {
  const authRequired = useAuthStore((state) => state.authRequired)
  const authed = useAuthStore((state) => state.authed)

  if (authRequired && !authed) {
    return <LoginPage />
  }

  return children
}
