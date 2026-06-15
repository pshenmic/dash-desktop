import React, { ReactNode, useEffect, useMemo, useState } from 'react'
import { SunIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useRipple } from '@renderer/hooks/useRipple'
import { useAuth } from '@renderer/contexts/AuthContext'
import { toDropdownOptions } from '@renderer/utils/wallets'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import DeleteWallet from './modal/DeleteWallet'
import DropdownSelect from './ui/DropdownSelect'
import ConnectionSelect from './ui/ConnectionSelect'
import NetworkSelect from './ui/NetworkSelect'
import SyncProgressBar from './ui/SyncProgressBar'
import SyncControlButton from './ui/SyncControlButton'
import { useResolvedTheme, setThemePreference } from '@renderer/hooks/useThemeController'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import type { ConnectionType, Network } from '@renderer/api/types'
import {
  CONNECTION_LABELS,
  CONNECTION_DESCRIPTIONS,
  P2P_FALLBACK_DESCRIPTION,
} from '@renderer/constants/connection'

interface LayoutProps {
  children: ReactNode
}

const headerButtonClass = `
  size-12
  overflow-hidden
  relative
  flex
  items-center
  justify-center
  cursor-pointer
  rounded-[.9375rem]
  dash-block
  dash-black-border
  group
`

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const [selectedWallet, setSelectedWallet] = useState('')
  const hoverNotification = useRipple()
  const { status, switchWallet, goToCreateWallet } = useAuth()
  const wallets = useWallets()
  const resolvedTheme = useResolvedTheme()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null)

  const openDeleteModal = (walletId: string) => {
    setWalletToDelete(walletId)
    setIsDeleteOpen(true)
  }

  useEffect(() => {
    refreshWallets()
  }, [])

 useEffect(() => {
    if (status?.selectedWalletId) {
      setSelectedWallet(status.selectedWalletId)
    } else if (wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0].walletId)
    }
  }, [status?.selectedWalletId, wallets, selectedWallet])

  const walletCounts = useMemo<Record<Network, number>>(() => ({
    mainnet: wallets.filter((w) => w.network === 'mainnet').length,
    testnet: wallets.filter((w) => w.network === 'testnet').length,
  }), [wallets])

  const currentNetwork: Network = (
    status?.network
      ?? wallets.find((w) => w.walletId === selectedWallet)?.network
      ?? 'mainnet'
  )

  const walletOptions = useMemo(
    () => toDropdownOptions(wallets, (w) => w.network === currentNetwork),
    [wallets, currentNetwork]
  )

  const handleNetworkSelect = (network: Network): void => {
    const target = wallets.find((w) => w.network === network && w.walletId !== selectedWallet)
      ?? wallets.find((w) => w.network === network)
    if (!target) return
    setSelectedWallet(target.walletId)
    switchWallet(target.walletId)
  }

  const { desired, showSyncUI, fallbackActive, setDesired } = useConnectionModeContext()

  const connectionOptions = useMemo(() => [
    {
      value: 'p2p',
      label: CONNECTION_LABELS.p2p,
      description: fallbackActive ? P2P_FALLBACK_DESCRIPTION : CONNECTION_DESCRIPTIONS.p2p,
    },
    {
      value: 'rpc',
      label: CONNECTION_LABELS.rpc,
      description: CONNECTION_DESCRIPTIONS.rpc,
    },
  ], [fallbackActive])

  const handleWalletChange = (walletId: string): void => {
    if (!walletId || walletId === selectedWallet) return
    setSelectedWallet(walletId)
    switchWallet(walletId)
  }

  return (
    <div id={"layout-root"} className={"relative w-full h-screen flex flex-col overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
      {showSyncUI && <SyncProgressBar />}

      <header className={"flex items-center justify-between mt-12 px-12"}>
        <div className={"flex items-center gap-[.625rem]"}>
          <DropdownSelect
            options={walletOptions}
            value={selectedWallet}
            onChange={handleWalletChange}
            onItemAction={openDeleteModal}
            onAdd={goToCreateWallet}
            addLabel={"Add wallet"}
          />
          <NetworkSelect
            value={currentNetwork}
            walletCounts={walletCounts}
            onSelectNetwork={handleNetworkSelect}
            onCreateOnNetwork={() => goToCreateWallet()}
          />
        </div>

        <div className={"flex items-center gap-[.625rem]"}>
          {showSyncUI && <SyncControlButton />}
          <ConnectionSelect
            options={connectionOptions}
            value={desired}
            onChange={(value) => setDesired(value as ConnectionType)}
          />
          <button
            onMouseEnter={hoverNotification.onMouseEnter}
            onMouseMove={hoverNotification.onMouseMove}
            onMouseLeave={hoverNotification.onMouseLeave}
            className={headerButtonClass}
            onClick={() => setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')}
            title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <SunIcon size={26} className="dash-text-default" />
          </button>
        </div>
      </header>

      <main className={"flex-1 mt-12"}>
        {children}
      </main>

      <DeleteWallet
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        walletToDelete={walletToDelete}
        setWalletToDelete={setWalletToDelete}
        refreshWallets={refreshWallets}
        selectedWallet={selectedWallet}
      />
    </div>
  )
}
