import { LazyMotion, MotionConfig, domMax } from 'motion/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RedirectRoute } from './components/redirect-route'
import DashboardLayout from './layouts/dashboard'
import OnboardingLayout from './layouts/onboarding'
import WelcomeLayout from './layouts/welcome'
import RootPage from './pages'
import CreateWalletPage from './pages/create'
import TransactionsPage from './pages/dashboard/index'
import SettingsPage from './pages/dashboard/settings'
import ImportWalletPage from './pages/import'
import './i18n'

export function App() {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route element={<RedirectRoute />}>
              <Route element={<WelcomeLayout />} path="/">
                <Route element={<RootPage />} index />
              </Route>
              <Route element={<OnboardingLayout />} path="/create">
                <Route element={<CreateWalletPage />} index />
              </Route>
              <Route element={<OnboardingLayout />} path="/import">
                <Route element={<ImportWalletPage />} index />
              </Route>
              <Route element={<DashboardLayout />} path="/dashboard">
                <Route element={<TransactionsPage />} index />
                <Route element={<SettingsPage />} path="/dashboard/settings" />
              </Route>
              <Route element={<Navigate replace to="/dashboard" />} path="*" />
            </Route>
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </LazyMotion>
  )
}

export default App
