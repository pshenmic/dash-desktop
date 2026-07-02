import { useRef, useState } from "react";
import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { Asset } from "@renderer/hooks/useAssetSelector";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import { ChevronIcon } from "dash-ui-kit/react";
import { TransferPageType } from "@renderer/constants";

type HeaderData = Omit<TransferPageType['header'], 'description'> & {
  description: React.ReactNode
}

interface HeaderProps {
  selectedAsset?: Asset
  assets?: Asset[]
  onSelectAsset?: (assetId: string) => void
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

export default function Header({selectedAsset, assets, onSelectAsset, data}: HeaderProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const interactive = assets != null && onSelectAsset != null

  useClickOutside(containerRef, () => setOpen(false))

  return (
    <div className={"flex items-end justify-between px-12"}>
      <div className={"flex flex-col gap-4.5"}>
        <div className={"flex items-center gap-4.5 flex-wrap"}>
          <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>{data.title}</Text>
          <div className={"relative"} ref={containerRef}>
            <button
              onClick={() => interactive && setOpen((v) => !v)}
              className={`
                p-[.25rem] pr-2 rounded-[.75rem] flex items-center gap-[.75rem] dash-block-accent-15
                ${interactive ? 'hover:opacity-80 transition-opacity duration-200 cursor-pointer' : ''}
              `}
            >
              <AssetBadge asset={selectedAsset} />
              <Text size={24} weight={"medium"} color={"blue-mint"} className={"leading-[120%]"}>{selectedAsset?.name}</Text>
              { interactive && <ChevronIcon size={12} className={`text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} /> }
            </button>

            {interactive && open && (
              <div className={"absolute left-0 top-[calc(100%+.5rem)] z-20 min-w-56 p-[.375rem] rounded-[.9375rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)]"}>
                {assets!.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => { onSelectAsset!(asset.id); setOpen(false) }}
                    className={`
                      w-full flex items-center gap-[.75rem] p-[.5rem] rounded-[.75rem] cursor-pointer
                      hover:dash-block-accent-10 transition-colors duration-150
                      ${asset.id === selectedAsset?.id ? 'dash-block-accent-5' : ''}
                    `}
                  >
                    <AssetBadge asset={asset} />
                    <Text size={16} weight={"medium"} color={"brand"} className={"leading-[120%]"}>{asset.name}</Text>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {data.description && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%] max-w-152.5"}>{data.description}</Text>
        )}
      </div>
    </div>
  )
}
