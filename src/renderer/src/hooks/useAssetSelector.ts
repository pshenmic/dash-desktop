import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export interface Asset {
  id: string
  name: string
  symbol: string
  icon?: string
  initials: string
  currency: string
}

export const ASSETS: Asset[] = [
  {
    id: 'dash',
    name: 'Dash',
    symbol: 'DASH',
    initials: 'D',
    currency: 'DASH',
  },
]

function readSelectedAssetId(): string {
  const saved = localStorage.getItem('asset-send')
  return ASSETS.some((a) => a.id === saved) ? (saved as string) : ASSETS[0].id
}

export function useAssetSelector() {
  const location = useLocation()
  const [selectedAssetId, setSelectedAssetId] = useState<string>(readSelectedAssetId)
  const [showModal, setShowModal] = useState(false)

  const openModal = () => setShowModal(true)
  const closeModal = () => setShowModal(false)

  useEffect(() => {
    localStorage.setItem('asset-send', selectedAssetId)
  }, [selectedAssetId])

  useEffect(() => {
    setShowModal(false)
  }, [location.pathname])

  const selectAsset = (assetId: string) => {
    setSelectedAssetId(assetId)
    closeModal()
  }

  const selectedAsset = ASSETS.find(asset => asset.id === selectedAssetId) ?? ASSETS[0]

  return {
    selectedAsset,
    assets: ASSETS,
    showModal,
    openModal,
    closeModal,
    selectAsset,
  }
}
