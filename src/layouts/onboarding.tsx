import { Outlet } from 'react-router-dom'

export default function OnboardingLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <main className="w-full max-w-2xl px-6">
        <Outlet />
      </main>
    </div>
  )
}
