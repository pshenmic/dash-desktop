import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { ReceivePageType } from "@renderer/constants";

interface HeaderProps {
  data: ReceivePageType['header']
}

export default function Header({data}: HeaderProps): React.JSX.Element {
  return (
    <div className={"flex items-end justify-between px-12"}>
      <div className={"flex flex-col gap-4.5"}>
        <div className={"flex items-center gap-4.5 flex-wrap"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>{data.title}</Text>
        </div>
      </div>
    </div>
  )
}
