import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ModalSize } from '@renderer/enums/ModalSize'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'

interface WalletUnlockModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  onUnlock: (password: string) => void | Promise<void>
}

export default function WalletUnlockModal({
  isOpen,
  onClose,
  walletId,
  onUnlock,
}: WalletUnlockModalProps): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError(null)
      setLoading(false)
    }
  }, [isOpen])

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || loading) return
    setLoading(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        setLoading(false)
        return
      }
      await onUnlock(password)
      onClose()
    } catch (e) {
      console.error('Wallet unlock failed', e)
      setError('Could not open the wallet. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={"Open wallet"}
      description={"Enter your wallet password to open this wallet and scan the shielded pool for your notes. Your seed never leaves this device."}
      size={ModalSize.Md}
      dismissible={!loading}
    >
      <PasswordField
        id={"wallet-unlock-password"}
        value={password}
        onChange={(value) => {
          setError(null)
          setPassword(value)
        }}
        onSubmit={handleConfirm}
        error={error}
        disabled={loading}
        className={"mt-4.5"}
      />

      <ModalActions
        secondary={{ label: 'Cancel', onClick: onClose, disabled: loading }}
        primary={{
          label: loading ? 'Opening…' : 'Open wallet',
          onClick: handleConfirm,
          disabled: password.length === 0 || loading,
        }}
      />
    </Modal>
  )
}
