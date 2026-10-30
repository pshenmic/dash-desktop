import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ModalSize } from '@renderer/enums/ModalSize'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'

interface ShieldedUnlockModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  onStarted?: () => void
}

export default function ShieldedUnlockModal({
  isOpen,
  onClose,
  walletId,
  onStarted,
}: ShieldedUnlockModalProps): React.JSX.Element {
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
      await API.startShieldedSync(walletId, password)
      onStarted?.()
      onClose()
    } catch (e) {
      console.error('startShieldedSync failed', e)
      setError('Could not start sync. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={"Sync shielded notes"}
      size={ModalSize.Md}
      dismissible={!loading}
    >
      <PasswordField
        id={"shielded-sync-password"}
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
          label: loading ? 'Syncing…' : 'Sync',
          onClick: handleConfirm,
          disabled: password.length === 0 || loading,
        }}
      />
    </Modal>
  )
}
