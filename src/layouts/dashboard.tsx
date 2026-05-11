import { PaperPlaneTiltIcon, QrCodeIcon, ScanIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AppSidebar } from '@/components/app-sidebar'
import { ReceiveModal } from '@/components/receive-modal'
import { SendModal } from '@/components/send-modal'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useMetadataMatcher } from '@/hooks/use-metadata-matcher'
import { useModalsStore } from '@/stores/modals'

const ROUTE_TITLE_KEYS: Record<string, string> = {
  '/dashboard': 'nav.transactions',
  '/dashboard/settings': 'nav.settings'
}

export default function DashboardLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [
    sendOpen,
    sendInitialStep,
    receiveOpen,
    openSend,
    setSendOpen,
    openReceive,
    setReceiveOpen
  ] = useModalsStore(
    useShallow((state) => [
      state.sendOpen,
      state.sendInitialStep,
      state.receiveOpen,
      state.openSend,
      state.setSendOpen,
      state.openReceive,
      state.setReceiveOpen
    ])
  )
  useMetadataMatcher()

  const routeTitleKey = ROUTE_TITLE_KEYS[pathname]
  const routeTitle = routeTitleKey ? t(routeTitleKey) : ''

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              className="mt-2 mr-2 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            <h3>{routeTitle}</h3>
          </div>
          <ul className="flex gap-2 pr-4">
            <li>
              <Button onClick={() => openSend('scan')} variant="outline">
                <ScanIcon />
                {t('actions.scan')}
              </Button>
            </li>
            <li>
              <Button onClick={openReceive}>
                <QrCodeIcon />
                {t('actions.receive')}
              </Button>
            </li>
            <li>
              <Button onClick={() => openSend('send')}>
                <PaperPlaneTiltIcon />
                {t('actions.send')}
              </Button>
            </li>
          </ul>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <ReceiveModal onOpenChange={setReceiveOpen} open={receiveOpen} />
        <SendModal initialStep={sendInitialStep} onOpenChange={setSendOpen} open={sendOpen} />
      </SidebarInset>
    </SidebarProvider>
  )
}
