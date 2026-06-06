import { useState } from 'react'
import { API } from '@renderer/api'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Button, Heading, Text } from '@renderer/components/dash-ui-kit-enxtended'

interface SettingsRowProps {
  title: string
  description: string
  actionLabel: string
  pendingLabel?: string
  pending?: boolean
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}

function SettingsRow({
  title,
  description,
  actionLabel,
  pendingLabel,
  pending = false,
  disabled = false,
  destructive = false,
  onClick,
}: SettingsRowProps): React.JSX.Element {
  return (
    <div
      className={`
        flex items-center justify-between gap-6
        py-4
        border-b border-dash-primary-dark-blue/8 dark:border-white/12
        last:border-b-0
      `}
    >
      <div className="flex flex-col gap-1">
        <Text size={16} weight="medium" color="brand">{title}</Text>
        <Text size={12} weight="normal" color="brand" opacity={50}>{description}</Text>
      </div>
      <Button
        onClick={onClick}
        disabled={disabled || pending}
        variant={destructive ? 'outline' : 'solid'}
        colorScheme={destructive ? 'red' : 'primary-light'}
        size="sm"
      >
        {pending && pendingLabel ? pendingLabel : actionLabel}
      </Button>
    </div>
  )
}

export default function Settings(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const [restartPending, setRestartPending] = useState(false)
  const [clearPending, setClearPending] = useState(false)

  const handleRestart = async (): Promise<void> => {
    if (!walletId || restartPending) return
    setRestartPending(true)
    try {
      await API.stopWalletSync()
      await API.startWalletSync(walletId)
    } catch (err) {
      console.error('restart sync failed', err)
    } finally {
      setRestartPending(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (!network || clearPending) return
    const ok = window.confirm(
      `Clear all sync cache for ${network}? This deletes downloaded headers, filters and wallet transaction history. The wallet itself is not affected.`,
    )
    if (!ok) return
    setClearPending(true)
    try {
      await API.resetWalletSync(network)
    } catch (err) {
      console.error('reset sync failed', err)
    } finally {
      setClearPending(false)
    }
  }

  return (
    <div className="w-full px-12 pb-12">
      <div className="shadow-[8px_0_64px_0_rgba(12,28,51,0.08)] dash-card-base rounded-3xl p-8">
        <div className="mb-6">
          <Heading as="h1" size="xl" weight="extrabold" color="brand-white">
            Settings
          </Heading>
        </div>

        <div className="mb-2">
          <Text size={12} weight="medium" color="brand" opacity={50} transform="uppercase">
            Sync
          </Text>
        </div>
        <div className="flex flex-col">
          <SettingsRow
            title="Restart sync"
            description="Stop and start the P2P sync for the current wallet."
            actionLabel="Restart"
            pendingLabel="Restarting…"
            pending={restartPending}
            disabled={walletId === null}
            onClick={handleRestart}
          />
          <SettingsRow
            title="Clear sync cache"
            description="Delete downloaded headers, filters, and transaction history for the current network. The wallet is preserved."
            actionLabel="Clear cache"
            pendingLabel="Clearing…"
            pending={clearPending}
            disabled={network === null}
            destructive
            onClick={handleClear}
          />
        </div>
      </div>
    </div>
  )
}
