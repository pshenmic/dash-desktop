import React, { ReactNode, useEffect, useMemo, useState } from 'react'
import { SunIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useRipple } from '@renderer/hooks/useRipple'
import { useAuth } from '@renderer/contexts/AuthContext'
import { toDropdownOptions } from '@renderer/utils/wallets'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import DropdownSelect from './ui/DropdownSelect'
import ConnectionButton from './ui/ConnectionButton'
import RefreshButton from './ui/RefreshButton'
import DataRefreshNotice from './ui/DataRefreshNotice'
import ScrollIndicator from './ui/ScrollIndicator'
import WalletUnlockModal from './modal/WalletUnlockModal'
import { API } from '@renderer/api'
import { useResolvedTheme, setThemePreference } from '@renderer/hooks/useThemeController'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'

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
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null)
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

  const { desired } = useConnectionModeContext()

  const handleWalletChange = (walletId: string): void => {
    if (!walletId || walletId === selectedWallet) return
    setPendingWalletId(walletId)
  }

  const handleUnlock = async (password: string): Promise<void> => {
    if (!pendingWalletId) return
    await switchWallet(pendingWalletId)
    API.startShieldedSync(pendingWalletId, password).catch(() => {})
  }

  return (
    <div id={SCROLL_CONTAINER_ID} className={"relative w-full h-screen flex flex-col overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
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
          {desired === 'rpc' && <RefreshButton />}
          <ConnectionButton />
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

      <main className="mt-12 flex-1">
        <DataRefreshNotice />
        {children}
      </main>

      <ScrollIndicator />

      <WalletUnlockModal
        isOpen={pendingWalletId !== null}
        onClose={() => setPendingWalletId(null)}
        walletId={pendingWalletId}
        onUnlock={handleUnlock}
      />
    </div>
  )
}
