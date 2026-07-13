import { NavItem } from "@renderer/constants";
import { IconProps } from "../dash-ui-kit-enxtended/icons";
import { Text } from "../dash-ui-kit-enxtended";
import NavLinkItem from "./NavLinkItem";

export interface NavGroupProps {
  items: NavItem
  icon: React.FC<IconProps>
  arrow?: boolean
}

export default function NavGroup({label, items}: {label?: string; items: NavGroupProps[]}): React.JSX.Element {
  return (
    <div className={"flex flex-col w-full gap-2"}>
      {label != null && (
        <Text size={10} weight={"medium"} color={"brand"} opacity={40} transform={"uppercase"} className={"px-3 tracking-wider"}>{label}</Text>
      )}
      <nav className={"flex flex-col w-full rounded-[.9375rem] overflow-hidden [&>a:last-child]:border-b-0"}>
        {items.map((item) => (
          <NavLinkItem key={item.items.id} item={item} />
        ))}
      </nav>
    </div>
  )
}
