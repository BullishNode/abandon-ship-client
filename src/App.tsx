import { BrowserRouter, Route, Routes } from 'react-router-dom'
import DashboardLayout from './layouts/dashboard'
import OnboardingLayout from './layouts/onboarding'
import RootPage from './pages'
import CreateWalletPage from './pages/create'
import DashboardPage from './pages/dashboard'
import ConsolePage from './pages/dashboard/console'
import ContactsPage from './pages/dashboard/contacts'
import SettingsPage from './pages/dashboard/settings'
import VtxosPage from './pages/dashboard/vtxos'
import ImportWalletPage from './pages/import'
import './i18n'
import WelcomeLayout from './layouts/welcome'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route element={<DashboardPage />} index />
          <Route element={<VtxosPage />} path="/dashboard/vtxos" />
          <Route element={<ContactsPage />} path="/dashboard/contacts" />
          <Route element={<ConsolePage />} path="/dashboard/console" />
          <Route element={<SettingsPage />} path="/dashboard/settings" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
