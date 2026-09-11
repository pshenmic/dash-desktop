import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { useAuth } from '@renderer/contexts/AuthContext'
import { isWalletSyncInactive } from '@renderer/utils/walletSync'

export default function P2pSyncAlert(): React.JSX.Element | null {
  const { showSyncWarning } = useConnectionModeContext()
  const { status } = useAuth()
  const paused = isWalletSyncInactive(status?.walletSync.phase)
  if (!showSyncWarning) return null

  return (
    <div className={"flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10"}>
      <div className={"flex flex-col gap-[.375rem]"}>
        <div className={"flex items-center gap-2"}>
          <ExclamationIcon size={16} className={"text-dash-orange"} />
          <Text size={14} weight={"extrabold"} className={"text-dash-orange!"}>{paused ? 'P2P sync is paused' : 'Waiting for P2P sync'}</Text>
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          {paused
            ? 'Sending from Dash Core (L1) requires up-to-date wallet data. Resume synchronization, or switch the connection mode to Dashscan API (RPC).'
            : 'Sending from Dash Core (L1) is unavailable while the wallet is syncing over P2P. Wait until synchronization completes, or switch the connection mode to Dashscan API (RPC).'}
        </Text>
      </div>
    </div>
  )
}
