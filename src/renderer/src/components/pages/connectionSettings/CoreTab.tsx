import {useEffect, useState} from 'react'
import {Text} from '@renderer/components/dash-ui-kit-enxtended'
import {useAuth} from '@renderer/contexts/AuthContext'
import {WalletSyncPhase} from '@renderer/api/types'
import {API} from '@renderer/api'
import {toast} from '@renderer/components/ui/Toast'
import {isWalletSyncInactive} from '@renderer/utils/walletSync'
import {getErrorMessage} from '@renderer/utils/error'
import type {WalletSyncAction} from '@renderer/types/connection'
import SyncProgressBar from '@renderer/components/ui/SyncProgressBar'

export default function CoreTab(): React.JSX.Element {
  const {status} = useAuth()
  const sync = status?.walletSync
  const walletId = status?.selectedWalletId ?? null
  const phase = sync?.phase ?? WalletSyncPhase.Stopped
  const syncInactive = isWalletSyncInactive(phase)
  const [pendingSyncAction, setPendingSyncAction] = useState<WalletSyncAction | null>(null)
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

  const handleNetworkToggle = (): void => {
    if (syncInactive) {
      void handleStartSync()
    } else {
      void handleStopSync()
    }
  }

  const peerCount = sync?.peerCount ?? 0

  return (
    <div className="pb-3">
      <Text as="h2" reset size={14} weight="medium" color="brand" opacity={50} className="mb-3">
        Peer Settings
      </Text>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex h-14 items-center justify-between rounded-[1.25rem] border border-dash-primary-dark-blue/12 bg-dash-primary-dark-blue/3 px-[.875rem] dark:border-white/12 dark:bg-white/3">
          <Text size={14} weight="medium" color="brand">Enable Network</Text>
          <button
            type="button"
            role="switch"
            aria-label="Enable network"
            aria-checked={!syncInactive}
            disabled={walletId === null || syncPending}
            onClick={handleNetworkToggle}
            className={`
              flex h-[1.625rem] w-[3.0625rem] items-center rounded-full p-px transition-colors
              disabled:cursor-wait disabled:opacity-60
              ${!syncInactive
                ? 'justify-end bg-dash-brand/25 dark:bg-dash-mint/20'
                : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
            `}
          >
            <span className={`size-6 rounded-full shadow-sm ${!syncInactive ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}`} />
          </button>
        </div>

        <div className="flex h-14 items-center justify-between rounded-[1.25rem] border border-dash-primary-dark-blue/12 bg-dash-primary-dark-blue/3 px-[.875rem] dark:border-white/12 dark:bg-white/3">
          <Text size={14} weight="medium" color="brand" opacity={50}>Use Static Peers</Text>
          <button
            type="button"
            role="switch"
            aria-label="Use static peers"
            aria-checked={false}
            disabled
            className="flex h-[1.625rem] w-[3.0625rem] cursor-not-allowed items-center justify-start rounded-full bg-dash-primary-dark-blue/15 p-px dark:bg-white/15"
          >
            <span className="size-6 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <Text as="h2" size={14} weight="medium" color="brand" opacity={50}>
          Peers List
        </Text>
        <Text size={14} weight="medium" color="brand" opacity={50}>
          {peerCount} Connected
        </Text>
      </div>

      <SyncProgressBar variant="compact" />

      <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-dash-primary-dark-blue/12 bg-dash-primary-dark-blue/3 dark:border-white/12 dark:bg-white/3">
        <div className="grid h-10 grid-cols-[1.25fr_1.1fr_.65fr] items-center border-b border-dash-primary-dark-blue/10 px-[.875rem] dark:border-white/10">
          <Text size={12} weight="medium" color="brand" opacity={50}>Peers</Text>
          <Text size={12} weight="medium" color="brand" opacity={50}>User Agent</Text>
          <Text size={12} weight="medium" color="brand" opacity={50} className="text-right">Ping Time</Text>
        </div>
        {peerCount > 0 ? Array.from({length: peerCount}, (_, index) => (
          <div
            key={index}
            className="grid h-[3.4375rem] grid-cols-[1.25fr_1.1fr_.65fr] items-center border-b border-dash-primary-dark-blue/10 px-[.875rem] last:border-b-0 dark:border-white/10"
          >
            <Text size={14} weight="medium" color="brand">Connected peer {index + 1}</Text>
            <Text size={14} weight="medium" color="brand" opacity={50}>Details unavailable</Text>
            <Text size={14} weight="medium" color="brand" opacity={50} className="text-right">—</Text>
          </div>
        )) : (
          <div className="flex h-[3.4375rem] items-center px-[.875rem]">
            <Text size={14} weight="medium" color="brand" opacity={50}>No peers connected</Text>
          </div>
        )}
      </div>
    </div>
  )
}
