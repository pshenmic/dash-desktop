import { useEffect, useState } from 'react'
import { SearchIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { Input } from '@renderer/components/dash-ui-kit-enxtended/input'
import { BigNumber, CrossIcon, Tabs } from 'dash-ui-kit/react'
import { Asset } from '@renderer/hooks/useAssetSelector'
import { useRipple } from '@renderer/hooks/useRipple'
import { createPortal } from 'react-dom'
import { SelectAssetType } from '@renderer/constants'
import NoResults from '../ui/NoResults'

interface AssetSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  assets: Asset[]
  selectedAssetId?: string
  onSelectAsset: (assetId: string) => void
  data: SelectAssetType
  balances?: Record<string, string>
}

export default function AssetSelectorModal({
  isOpen,
  onClose,
  assets,
  selectedAssetId,
  onSelectAsset,
  data,
  balances
}: AssetSelectorModalProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'tokens' | 'nfts'>('tokens')
  const hover = useRipple()
  const [layoutRoot, setLayoutRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setLayoutRoot(document.getElementById('layout-root'))
  }, [])

  if (!isOpen || !layoutRoot) return null

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.currency.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  const assetsList = [
    {
      value: 'tokens',
      label: 'Tokens',
      content: (
        <div className={"flex flex-col gap-[.625rem]"}>
          {filteredAssets.length > 0 ? (
            filteredAssets.map((asset) => {
              const isSelected = selectedAssetId === asset.id
              return (
                <button
                  key={asset.id}
                  onClick={() => onSelectAsset(asset.id)}
                  className={`
                    flex items-center justify-between
                    px-[.9375rem] py-[.625rem] rounded-[.9375rem]
                    cursor-pointer
                    transition-colors duration-200
                    ${isSelected
                      ? 'dash-block-accent-10'
                      : 'dash-block-3 hover:bg-dash-primary-dark-blue/10 dark:hover:bg-white/10'
                    }
                  `}
                >
                  <div className={"flex items-center"}>
                    <div className={"relative size-9.75 flex items-center justify-center rounded-full dash-block-3 dash-black-border"}>
                      {asset?.icon ? (
                        <img
                          src={asset.icon}
                          alt={asset.name}
                          className={"size-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"}
                        />
                      ) : (
                        <Text size={16} weight={"medium"} color={"default"}>
                          {asset?.initials}
                        </Text>
                      )}
                    </div>
                    <Text size={14} weight={"medium"} color={"default"} className={"ml-[.75rem] mr-[.5rem]"}>
                      {asset.name}
                    </Text>
                    <div className={"px-[.3125rem] py-[.1875rem] dash-block-accent-10 h-fit rounded-[.25rem] flex"}>
                      <Text size={10} weight={"medium"} color={"blue-mint"} className={"leading-none"}>
                        {asset.symbol}
                      </Text>
                    </div>
                  </div>
                  <Text size={14} weight={"extrabold"} color={"default"}>
                    <BigNumber>{balances?.[asset.id] ?? '—'}</BigNumber>
                    <span className={"font-medium"}> {asset.currency}</span>
                  </Text>
                </button>
              )
            })
          ) : (
            <NoResults noResults={data.noResults} />
          )}
        </div>
      )
    },
    {
      value: 'nfts',
      label: 'NFTs',
      content: (
        <div className={"flex flex-col items-center justify-center py-12"}>
          <Text size={14} color={"default"} opacity={50}>
            NFTs coming soon
          </Text>
        </div>
      ),
    }
  ]

  return createPortal (
    <div className={"absolute inset-0 z-10 flex flex-col bg-white dash-bg-gradient p-12 min-h-screen w-full overflow-auto scrollbar-hide"}>
      <div className={"flex items-center justify-between w-full mb-6"}>
        <Text size={40} weight={"medium"} color={"brand"} className={"leading-[125%] tracking-[-0.03em]"}>{data.title}</Text>
        <button onClick={onClose} className={"rounded-[.9375rem] relative dash-block-3 cursor-pointer size-12 overflow-hidden"} {...hover}>
          <CrossIcon size={18} className={"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 dash-text-default"} />
        </button>
      </div>
      <Input
        placeholder={data.placeholder}
        value={searchQuery}
        variant={"filled"}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={'rounded-[1.25rem] wallet-input'}
        colorScheme={"light"}
        prefix={<SearchIcon size={16} className={"dash-text-default"} />}
        prefixClassName={"absolute top-1/2 left-4"}
        autoFocus
      />
      <Tabs
        items={assetsList}
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'tokens' | 'nfts')}
        size={"lg"}
        triggerClassName={
          'data-[state=active]:text-dash-primary-dark-blue ' +
          'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
          'dark:data-[state=active]:text-white ' +
          'dark:data-[state=inactive]:text-white/35 ' +
          'font-medium tracking-[-0.03em] mt-[2rem]'
        }
      />
    </div>,
    layoutRoot
  )
}
