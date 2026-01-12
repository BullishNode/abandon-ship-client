import { PaperPlaneTiltIcon, QrCodeIcon, ScanIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'

export default function DashboardLayout() {
  const { t } = useTranslation()

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
            <h3>Current route name</h3>
          </div>
          <ul className="flex gap-2 pr-4">
            <li>
              <Button variant="outline">
                <ScanIcon />
                {t('actions.scan')}
              </Button>
            </li>
            <li>
              <Button>
                <QrCodeIcon />
                {t('actions.receive')}
              </Button>
            </li>
            <li>
              <Button>
                <PaperPlaneTiltIcon />
                {t('actions.send')}
              </Button>
            </li>
          </ul>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
