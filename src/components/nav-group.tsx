import { Link, useLocation } from 'react-router-dom'
import type { NavItem } from '@/types/nav'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from './ui/sidebar'

export interface NavGroupProps extends React.ComponentPropsWithoutRef<typeof SidebarGroup> {
  label?: string
  items: NavItem[]
}

export function NavGroup({ items, label, ...props }: NavGroupProps) {
  const location = useLocation()

  return (
    <SidebarGroup {...props}>
      {label !== undefined && label !== '' && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild isActive={location.pathname === item.url}>
              <Link to={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
