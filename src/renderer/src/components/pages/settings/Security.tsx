import { useState } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { refreshWallets } from '@renderer/hooks/useWallets'
import DeleteWallet from '@renderer/components/modal/DeleteWallet'
import ExportMnemonic from '@renderer/components/modal/ExportMnemonic'
import SettingsDetailHeader from './SettingsDetailHeader'
import SettingsRow from './SettingsRow'
import SettingsSection from './SettingsSection'

export default function SecuritySettings(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null)
  const [isMnemonicOpen, setIsMnemonicOpen] = useState(false)

  const openDelete = (): void => {
    if (!walletId) return
    setWalletToDelete(walletId)
    setIsDeleteOpen(true)
  }

  return (
    <div className="w-full pb-12">
      <SettingsDetailHeader primary="Security" secondary="& Privacy" />
      <div className="mt-8 px-12">
        <div className="max-w-[42rem]">
          <SettingsSection title="Recovery">
            <SettingsRow
              title="Recovery phrase"
              description="Reveal this wallet's secret recovery phrase. Anyone with these words can access your funds."
              actionLabel="Reveal phrase"
              disabled={walletId === null}
              onClick={() => setIsMnemonicOpen(true)}
            />
          </SettingsSection>

          <SettingsSection title="Danger zone">
            <SettingsRow
              title="Delete wallet"
              description="Permanently remove this wallet from this device. Make sure its recovery phrase is backed up first."
              actionLabel="Delete wallet"
              disabled={walletId === null}
              destructive
              onClick={openDelete}
            />
          </SettingsSection>
        </div>
      </div>

      <DeleteWallet
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        walletToDelete={walletToDelete}
        setWalletToDelete={setWalletToDelete}
        refreshWallets={refreshWallets}
      />
      <ExportMnemonic
        isOpen={isMnemonicOpen}
        onClose={() => setIsMnemonicOpen(false)}
        walletId={walletId}
      />
    </div>
  )
}
