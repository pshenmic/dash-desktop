import {useEffect, useState} from 'react'
import {Button, Text} from '@renderer/components/dash-ui-kit-enxtended'
import {useAuth} from '@renderer/contexts/AuthContext'
import {useConnectionModeContext} from '@renderer/contexts/ConnectionModeContext'
import {
  RPC_CONNECTION_NAME,
  SYNC_ACTION_LABELS,
  WALLET_SYNC_PHASE_LABELS,
} from '@renderer/constants/connection'
import {WalletSyncPhase} from '@renderer/api/types'
import {API} from '@renderer/api'
import {toast} from '@renderer/components/ui/Toast'
import {isWalletSyncInactive} from '@renderer/utils/walletSync'
import {getErrorMessage} from '@renderer/utils/error'
import type {WalletSyncAction} from '@renderer/types/connection'
import {invalidateAllAsyncCaches} from '@renderer/hooks/useAsyncWithCache'

export default function CoreTab(): React.JSX.Element {
  const {status} = useAuth()
  const {desired, ready, setDesired} = useConnectionModeContext()
  const sync = status?.walletSync
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const syncInactive = isWalletSyncInactive(phase)
  const [pendingSyncAction, setPendingSyncAction] = useState<WalletSyncAction | null>(null)
  const [clearPending, setClearPending] = useState(false)
  const syncPending = pendingSyncAction !== null

  useEffect(() => {
    if (pendingSyncAction === 'start' && !syncInactive) {
      setPendingSyncAction(null)
    } else if (pendingSyncAction === 'stop' && syncInactive) {
      setPendingSyncAction(null)
    }
  }, [pendingSyncAction, syncInactive])

  const handleStartSync = async (): Promise<void> => {
    if (!walletId || syncPending || !syncInactive) return
    setPendingSyncAction('start')
    try {
      await API.startWalletSync(walletId)
      localStorage.setItem('wallet.sync.enabled', 'true')
    } catch (err) {
      setPendingSyncAction(null)
      console.error('start wallet sync failed', err)
      toast.error(`**Could not start synchronization** ${getErrorMessage(err)}`)
    }
  }

  const handleStopSync = async (): Promise<void> => {
    if (syncPending || syncInactive) return
    setPendingSyncAction('stop')
    try {
      await API.stopWalletSync()
      localStorage.setItem('wallet.sync.enabled', 'false')
    } catch (err) {
      setPendingSyncAction(null)
      console.error('stop wallet sync failed', err)
      toast.error(`**Could not stop synchronization** ${getErrorMessage(err)}`)
    }
  }

  const handleClearSyncData = async (): Promise<void> => {
    if (!network || clearPending) return
    const confirmed = window.confirm(
      `Clear all sync cache for ${network}? This deletes downloaded headers, filters and wallet transaction history. The wallet itself is not affected.`,
    )
    if (!confirmed) return
    setClearPending(true)
    try {
      await API.resetWalletSync(network)
      invalidateAllAsyncCaches()
    } catch (err) {
      console.error('reset sync failed', err)
      toast.error(`**Could not clear synchronization data** ${getErrorMessage(err)}`)
    } finally {
      setClearPending(false)
    }
  }

  return (
    <div className="px-2 pb-3">
      <Text as="h2" size={14} weight="medium" color="brand" opacity={50} className="mb-4">
        Connection Mode
      </Text>

      <div className="grid grid-cols-2 gap-5">
        <div className="flex min-h-16 items-center justify-between rounded-[1.25rem] dash-block px-5 py-3">
          <Text size={14} weight="medium" color="brand">Enable P2P Mode</Text>
          <button
            type="button"
            role="switch"
            aria-checked={desired === 'p2p'}
            disabled={!ready}
            onClick={() => desired !== 'p2p' && setDesired('p2p')}
            className={`
              flex h-7 w-14 items-center rounded-full p-0.5 transition-colors
              disabled:cursor-wait disabled:opacity-50
              ${desired === 'p2p'
                ? 'justify-end bg-dash-brand/35 dark:bg-dash-mint/25'
                : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
            `}
          >
            <span className={`size-6 rounded-full shadow-sm ${desired === 'p2p' ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}`} />
          </button>
        </div>

        <div className="flex min-h-16 items-center justify-between rounded-[1.25rem] dash-block px-5 py-3">
          <Text size={14} weight="medium" color="brand">Enable RPC Mode</Text>
          <button
            type="button"
            role="switch"
            aria-checked={desired === 'rpc'}
            disabled={!ready}
            onClick={() => desired !== 'rpc' && setDesired('rpc')}
            className={`
              flex h-7 w-14 items-center rounded-full p-0.5 transition-colors
              disabled:cursor-wait disabled:opacity-50
              ${desired === 'rpc'
                ? 'justify-end bg-dash-brand/35 dark:bg-dash-mint/25'
                : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
            `}
          >
            <span className={`size-6 rounded-full shadow-sm ${desired === 'rpc' ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}`} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Text as="h2" size={14} weight="medium" color="brand" opacity={50} className="mb-3">
          P2P Wallet Synchronization
        </Text>
        <div className="overflow-hidden rounded-[1.25rem] dash-block">
          <div className="flex min-h-20 items-center justify-between gap-6 px-5 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-3">
                <Text size={14} weight="medium" color="brand">{WALLET_SYNC_PHASE_LABELS[phase]}</Text>
                <span
                  className={`size-2 shrink-0 rounded-full ${syncInactive ? 'bg-dash-orange' : 'bg-dash-mint'}`}
                  aria-hidden="true"
                />
              </div>
              <Text size={10} weight="medium" color="brand" opacity={40}>
                Downloads and scans wallet data in the background, independently of the connection mode.
              </Text>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {syncInactive ? (
                <Button
                  onClick={handleStartSync}
                  disabled={walletId === null || syncPending}
                  variant="solid"
                  colorScheme="primary"
                  size="sm"
                  className="min-h-0! rounded-[.75rem] px-4! py-2!"
                >
                  {pendingSyncAction === 'start' ? 'Starting…' : SYNC_ACTION_LABELS.start}
                </Button>
              ) : (
                <Button
                  onClick={handleStopSync}
                  disabled={syncPending}
                  variant="outline"
                  colorScheme="brand-mint"
                  size="sm"
                  className="min-h-0! rounded-[.75rem] px-4! py-2!"
                >
                  {pendingSyncAction === 'stop' ? 'Stopping…' : SYNC_ACTION_LABELS.stop}
                </Button>
              )}
            </div>
          </div>
          <div className="flex min-h-20 items-center justify-between gap-6 border-t border-dash-primary-dark-blue/10 px-5 py-3 dark:border-white/10">
            <div className="flex min-w-0 flex-col gap-1">
              <Text size={14} weight="medium" color="brand">Clear sync data</Text>
              <Text size={10} weight="medium" color="brand" opacity={40}>
                Delete downloaded headers, filters, and transaction history for the current network.
              </Text>
            </div>
            <Button
              onClick={handleClearSyncData}
              disabled={network === null || clearPending}
              variant="outline"
              colorScheme="red"
              size="sm"
              className="min-h-0! shrink-0 rounded-[.75rem] px-4! py-2!"
            >
              {clearPending ? 'Clearing…' : 'Clear sync data'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Text as="h2" size={14} weight="medium" color="brand" opacity={50} className="mb-3">
          RPC Connection
        </Text>
        <div
          className={`
            flex h-16 w-full cursor-not-allowed items-center rounded-[1.25rem]
            border border-dash-primary-dark-blue/25 dark:border-white/25
            px-5
          `}
        >
          <Text size={14} weight="medium" color="brand">{RPC_CONNECTION_NAME}</Text>
        </div>
      </div>
    </div>
  )
}
