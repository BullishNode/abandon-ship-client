import { Outlet } from 'react-router-dom'
import { FullScreenLayout } from '@/components/full-screen-layout'

export default function WelcomeLayout() {
  return (
    <FullScreenLayout>
      <Outlet />
    </FullScreenLayout>
  )
}
