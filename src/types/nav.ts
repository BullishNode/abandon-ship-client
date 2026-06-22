import type { Icon } from '@phosphor-icons/react'

export type NavIcon = Icon | React.FC<React.SVGProps<SVGSVGElement>>

export interface NavItem {
  name: string
  url: string
  icon: NavIcon
}
