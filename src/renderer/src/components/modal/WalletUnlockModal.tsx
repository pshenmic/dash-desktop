import { useEffect, useState } from 'react'
import { Input, Text } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ModalSize } from '@renderer/enums/ModalSize'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'

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
      <div className={"mt-4.5"}>
        <Input
          id={"wallet-unlock-password"}
          type={"password"}
          placeholder={"Wallet password"}
          value={password}
          variant={"outlined"}
          onChange={(e) => {
            setError(null)
            setPassword(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm()
          }}
          className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
          colorScheme={error ? 'error' : 'primary'}
          disabled={loading}
          autoFocus
        />
      </div>

      <div
        className={`
          overflow-hidden transition-all duration-200
          ${error ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0'}
        `}
      >
        <Text size={12} weight={"medium"} color={"red"}>{error}</Text>
      </div>

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
