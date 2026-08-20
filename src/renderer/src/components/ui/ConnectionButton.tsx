import { useNavigate } from 'react-router-dom'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ConnectionIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { useAuth } from '@renderer/contexts/AuthContext'
import { WalletSyncPhase } from '@renderer/api/types'
import { useRipple } from '@renderer/hooks/useRipple'
import {useRpcStatus} from '@renderer/hooks/useRpcStatus'

export default function ConnectionButton(): React.JSX.Element {
  const navigate = useNavigate()
  const hover = useRipple()
  const { desired, syncIncomplete } = useConnectionModeContext()
  const { status } = useAuth()
  const phase = status?.walletSync.phase
  const rpcStatus = useRpcStatus(status?.network ?? null, desired === 'rpc')
  const isSyncing = desired === 'p2p' && syncIncomplete

  const statusLabel = desired === 'rpc'
    ? rpcStatus === 'connected' ? 'Connected' : rpcStatus === 'unavailable' ? 'Unavailable' : 'Connecting'
    : phase === WalletSyncPhase.Synced
      ? 'Synced'
      : isSyncing
        ? 'Synchronizing'
        : 'Connected'
  const hasWarning = isSyncing || (desired === 'rpc' && rpcStatus !== 'connected')
  const statusColor = hasWarning ? 'text-dash-orange!' : 'text-dash-mint!'
  const iconShadowColor = hasWarning ? 'var(--color-dash-orange)' : 'var(--color-dash-mint)'

  return (
    <button
      type="button"
      onClick={() => navigate('/connection-settings')}
      onMouseEnter={hover.onMouseEnter}
      onMouseMove={hover.onMouseMove}
      onMouseLeave={hover.onMouseLeave}
      className={`
        relative overflow-hidden
        flex h-12 items-center gap-2.5 px-4 py-2
        rounded-[.9375rem] dash-block-3 dash-black-border
        cursor-pointer focus:outline-none
        hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5
      `}
      title="Open connection settings"
    >
      <ConnectionIcon
        width={10}
        height={10}
        className={`${statusColor} shrink-0`}
        style={{ filter: `drop-shadow(0 0 5px ${iconShadowColor})` }}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-col items-start">
        <Text size={14} weight="medium" color="brand" className="leading-4">
          Connection
        </Text>
        <Text size={10} weight="medium" className={`leading-[.875rem] ${statusColor}`}>
          {statusLabel}
        </Text>
      </span>
    </button>
  )
}
