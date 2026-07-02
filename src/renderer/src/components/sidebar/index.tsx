import { navGroups } from "@renderer/constants";
import { DashboardIcon, SendIcon, SettingsIcon, ShieldSmallIcon, AddressesIcon, TransactionsIcon, ReceiveIcon, SignIcon, LockIcon } from "../dash-ui-kit-enxtended/icons";
import { cva } from "class-variance-authority";
import { IconProps } from "../dash-ui-kit-enxtended/icons";
import SidebarHeader from "./SidebarHeader";
import SidebarNavGroup from "../ui/NavGroup";

const iconMap: Record<string, React.FC<IconProps>> = {
  'dashboard': DashboardIcon,
  'transactions': TransactionsIcon,
  'send': SendIcon,
  'receive': ReceiveIcon,
  'shield': LockIcon,
  'shielded': ShieldSmallIcon,
  'addresses': AddressesIcon,
  'identities': SignIcon,
  'support': ShieldSmallIcon,
  'settings': SettingsIcon
}

const asideStyles = cva(
  `
    relative
    h-screen
    flex
    flex-col
    min-w-[16.125rem]
    bg-white dark:bg-transparent
    dark:border-r-1 dark:border-white/32
    rounded-r-[2rem]
    shrink-0
    shadow-[8px_0_64px_0_rgba(12,28,51,0.08)]
    transition-[margin-left]
    duration-300
    ease
    z-20
  `
)

export default function Sidebar(): React.JSX.Element {
  return (
    <aside className={asideStyles()}>
      <div className={"flex flex-col h-full w-full justify-between gap-8.5 overflow-auto py-12 px-6 items-end scrollbar-hide"}>
        <SidebarHeader />
        <div className={"flex flex-col h-full w-full justify-between gap-8.5"}>
          {navGroups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              items={group.items.map((item) => ({
                items: item,
                icon: iconMap[item.id]
              }))}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
