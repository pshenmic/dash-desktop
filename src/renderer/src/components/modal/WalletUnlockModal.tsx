import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text } from '../dash-ui-kit-enxtended'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'

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
}: WalletUnlockModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
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

  if (!isOpen) return null

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || loading) return
    setLoading(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError('Incorrect password. Please try again.')
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

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
    >
      <div
        className={"w-full max-w-115 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            Open wallet
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer"}
            onClick={onClose}
            disabled={loading}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-2 block"}>
          Enter your wallet password to open this wallet and scan the shielded pool for your notes. Your seed never leaves this device.
        </Text>

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

        <div className={"mt-4.5 flex gap-2"}>
          <Button
            type={"button"}
            onClick={onClose}
            variant={"solid"}
            colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
            size={"md"}
            className={"flex-1 rounded-[.9375rem]"}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type={"button"}
            onClick={handleConfirm}
            disabled={password.length === 0 || loading}
            variant={"solid"}
            colorScheme={"primary"}
            size={"md"}
            className={"flex-1 rounded-[.9375rem]"}
          >
            {loading ? 'Opening…' : 'Open wallet'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
