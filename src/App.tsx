import { BrowserRouter, Route, Routes } from 'react-router-dom'
import DashboardLayout from './layouts/dashboard'
import DashboardPage from './pages/dashboard'
import ConsolePage from './pages/dashboard/console'
import ContactsPage from './pages/dashboard/contacts'
import SettingsPage from './pages/dashboard/settings'
import VtxosPage from './pages/dashboard/vtxos'
import RootPage from './pages/root'
import './i18n'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootPage />} path="/" />
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
