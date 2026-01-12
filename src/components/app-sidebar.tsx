import {
  AddressBookIcon,
  GearIcon,
  SquareIcon,
  SquaresFourIcon,
  TerminalWindowIcon
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import secondIcon from '@/assets/second_icon.svg'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import type { Wallet } from '@/types/wallet'
import { NavGroup, type NavGroupProps } from './nav-group'
import { NavWallet } from './nav-wallet'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()

  const navMainItems: NavGroupProps['items'] = [
    {
      name: t('nav.transactions'),
      url: '/dashboard',
      icon: SquaresFourIcon
    },
    {
      name: t('nav.vtxos'),
      url: '/dashboard/vtxos',
      icon: SquareIcon
    },
    {
      name: t('nav.contacts'),
      url: '/dashboard/contacts',
      icon: AddressBookIcon
    }
  ]

  const navSecondaryItems: NavGroupProps['items'] = [
    {
      name: t('nav.console'),
      url: '/dashboard/console',
      icon: TerminalWindowIcon
    },
    {
      name: t('nav.settings'),
      url: '/dashboard/settings',
      icon: GearIcon
    }
  ]

  const wallets: Wallet[] = [
    {
      id: '1',
      name: `Byte's wallet`,
      avatar: 'https://picsum.photos/id/237/200'
    }
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex gap-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <img
                  alt="Second Icon"
                  height={20}
                  src={secondIcon}
                  width={20}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Second</span>
                <span className="truncate text-xs">bark-web</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={navMainItems} label={t('nav.wallet', { count: 1 })} />
        <NavGroup className="mt-auto" items={navSecondaryItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavWallet selectedWalletId="1" wallets={wallets} />
      </SidebarFooter>
    </Sidebar>
  )
}
