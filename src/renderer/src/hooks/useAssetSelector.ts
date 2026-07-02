import { useState, useEffect } from 'react'

export interface Asset {
  id: string
  name: string
  symbol: string
  icon?: string
  initials: string
  currency: string
}

export const PLATFORM_CREDITS_ASSET_ID = 'platform-credits'

export const ASSETS: Asset[] = [
  {
    id: 'dash',
    name: 'Dash',
    symbol: 'DASH',
    initials: 'D',
    currency: 'DASH',
  },
  {
    id: PLATFORM_CREDITS_ASSET_ID,
    name: 'Platform Credits',
    symbol: 'CREDITS',
    initials: 'P',
    currency: 'CREDITS',
  },
]

function readSelectedAssetId(): string {
  const saved = localStorage.getItem('asset-send')
  return ASSETS.some((a) => a.id === saved) ? (saved as string) : ASSETS[0].id
}

export function useAssetSelector() {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(readSelectedAssetId)

  useEffect(() => {
    localStorage.setItem('asset-send', selectedAssetId)
  }, [selectedAssetId])

  const selectAsset = (assetId: string): void => {
    setSelectedAssetId(assetId)
  }

  const selectedAsset = ASSETS.find(asset => asset.id === selectedAssetId) ?? ASSETS[0]

  return {
    selectedAsset,
    assets: ASSETS,
    selectAsset,
  }
}
