import React, { ReactNode, useEffect, useMemo, useState } from 'react'
import { SunIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useRipple } from '@renderer/hooks/useRipple'
import { useAuth } from '@renderer/contexts/AuthContext'
import { toDropdownOptions } from '@renderer/utils/wallets'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import DropdownSelect from './ui/DropdownSelect'
import ConnectionSelect from './ui/ConnectionSelect'
import SyncProgressBar from './ui/SyncProgressBar'
import SyncControlButton from './ui/SyncControlButton'
import { useResolvedTheme, setThemePreference } from '@renderer/hooks/useThemeController'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import type { ConnectionType } from '@renderer/api/types'
import { CONNECTION_LABELS } from '@renderer/constants/connection'

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

const connectionOptions = [
  { value: 'p2p', label: CONNECTION_LABELS.p2p },
  { value: 'rpc', label: CONNECTION_LABELS.rpc },
]

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const [selectedWallet, setSelectedWallet] = useState('')
  const hoverNotification = useRipple()
  const { status, switchWallet, goToCreateWallet } = useAuth()
  const wallets = useWallets()
  const resolvedTheme = useResolvedTheme()

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

  const walletOptions = useMemo(
    () => toDropdownOptions(wallets),
    [wallets]
  )

  const { desired, showSyncUI, setDesired } = useConnectionModeContext()

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
            onAdd={goToCreateWallet}
            addLabel={"Add wallet"}
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
    </div>
  )
}
