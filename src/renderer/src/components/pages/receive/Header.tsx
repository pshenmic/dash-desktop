import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { ReceivePageType } from "@renderer/constants";

type HeaderData = Omit<ReceivePageType['header'], 'description'> & {
  description: React.ReactNode
}

interface HeaderProps {
  data: HeaderData
}

export default function Header({data}: HeaderProps): React.JSX.Element {
  return (
    <div className={"flex items-end justify-between px-12"}>
      <div className={"flex flex-col gap-4.5"}>
        <div className={"flex items-center gap-4.5 flex-wrap"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>{data.title}</Text>
        </div>
        {data.description && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>{data.description}</Text>
        )}
      </div>
    </div>
  )
}
