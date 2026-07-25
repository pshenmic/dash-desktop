import { navGroups } from "@renderer/constants";
import { DashboardIcon, SendIcon, SettingsIcon, ShieldSmallIcon, AddressesIcon, TransactionsIcon, ReceiveIcon, SignIcon } from "../dash-ui-kit-enxtended/icons";
import { cva } from "class-variance-authority";
import { IconProps } from "../dash-ui-kit-enxtended/icons";
import SidebarHeader from "./SidebarHeader";
import SidebarNavGroup from "../ui/NavGroup";
import { useDebugMode } from "@renderer/hooks/useDebugMode";

const iconMap: Record<string, React.FC<IconProps>> = {
  'dashboard': DashboardIcon,
  'transactions': TransactionsIcon,
  'send': SendIcon,
  'receive': ReceiveIcon,
  'shielded': ShieldSmallIcon,
  'addresses': AddressesIcon,
  'identities': SignIcon,
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
  const debugMode = useDebugMode()

  return (
    <aside className={asideStyles()}>
      <div className={"flex flex-col h-full w-full justify-between gap-8.5 overflow-auto py-12 px-6 items-end scrollbar-hide"}>
        <SidebarHeader />
        <div className={"flex flex-col h-full w-full gap-6"}>
          {navGroups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              label={group.label}
              items={group.items
                .filter((item) => !item.debugOnly || debugMode)
                .map((item) => ({
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
