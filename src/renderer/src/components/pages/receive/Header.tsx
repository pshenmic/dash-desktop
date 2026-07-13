import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { ReceivePageType } from "@renderer/constants";

export interface Asset {
  id: string
  name: string
  symbol: string
  icon?: string
  initials: string
  currency: string
}

type HeaderData = Omit<ReceivePageType['header'], 'description'> & {
  description: React.ReactNode
}

interface HeaderProps {
  selectedAsset?: Asset
  data: HeaderData
}

function AssetBadge({asset}: {asset?: Asset}): React.JSX.Element {
  return (
    <div className={"size-8 flex items-center justify-center rounded-[.5rem] dash-bg-inverse"}>
      {asset?.icon ?
        <img src={asset.icon} alt={asset.name} className={"size-4.5"} />
      :
        <Text size={20} weight={"medium"} color={"blue-mint"}>{asset?.initials}</Text>
      }
    </div>
  )
}

export default function Header({selectedAsset, data}: HeaderProps): React.JSX.Element {
  return (
    <div className={"flex items-end justify-between px-12"}>
      <div className={"flex flex-col gap-4.5"}>
        <div className={"flex items-center gap-4.5 flex-wrap"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>{data.title}</Text>
          <div className={"p-[.25rem] pr-2 rounded-[.75rem] flex items-center gap-[.75rem] dash-block-accent-15"}>
            <AssetBadge asset={selectedAsset} />
            <Text size={24} weight={"medium"} color={"blue-mint"} className={"leading-[120%]"}>{selectedAsset?.name}</Text>
          </div>
        </div>
        {data.description && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>{data.description}</Text>
        )}
      </div>
    </div>
  )
}
