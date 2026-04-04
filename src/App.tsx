import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from 'react-router-dom'
import { Spinner } from './components/ui/spinner'
import { useCheckWallet } from './hooks/barkd/use-check-wallet'
import DashboardLayout from './layouts/dashboard'
import OnboardingLayout from './layouts/onboarding'
import WelcomeLayout from './layouts/welcome'
import RootPage from './pages'
import CreateWalletPage from './pages/create'
import ConsolePage from './pages/dashboard/console'
import ContactsPage from './pages/dashboard/contacts'
import TransactionsPage from './pages/dashboard/index'
import SettingsPage from './pages/dashboard/settings'
import VtxosPage from './pages/dashboard/vtxos'
import ImportWalletPage from './pages/import'
import './i18n'

function RedirectRoute() {
  const { data: walletExists, isPending } = useCheckWallet({ staleTime: 0 })
  const location = useLocation()

  const isOnboarding =
    location.pathname === '/create' || location.pathname === '/import'
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

  if (walletExists && !isDashboard) {
    return <Navigate replace to="/dashboard" />
  }

  if (!walletExists && isDashboard) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}

export function App() {
  return (
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
            <Route element={<VtxosPage />} path="/dashboard/vtxos" />
            <Route element={<ContactsPage />} path="/dashboard/contacts" />
            <Route element={<ConsolePage />} path="/dashboard/console" />
            <Route element={<SettingsPage />} path="/dashboard/settings" />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
