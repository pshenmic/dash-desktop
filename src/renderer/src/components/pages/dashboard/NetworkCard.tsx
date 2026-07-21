import { Text, WebIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { dashboardPage } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ConnectionType } from '@renderer/api/types'
import { describeDataSource, describeNetworkStatus, NetworkStatusTone } from '@renderer/utils/networkStatus'

const STATUS_TONES: Record<NetworkStatusTone, { pill: string; dot: string; text: string }> = {
  ok: { pill: 'bg-dash-green-15', dot: 'bg-dash-green', text: 'text-dash-green' },
  busy: { pill: 'bg-dash-orange-15', dot: 'bg-dash-orange', text: 'text-dash-orange' },
  warn: { pill: 'bg-dash-red-15', dot: 'bg-dash-red', text: 'text-dash-red' }
}

function desiredConnection(): ConnectionType {
  return localStorage.getItem('wallet.connection.desired') === 'p2p' ? 'p2p' : 'rpc'
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-1"}>
      <Text size={10} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
        {label}
      </Text>
      <Text size={14} weight={"bold"} color={"brand"} className={"leading-[120%]"}>
        {value}
      </Text>
    </div>
  )
}

export default function NetworkCard(): React.JSX.Element {
  const { status } = useAuth()
  const sync = status?.walletSync
  const labels = dashboardPage.network

  const networkStatus = describeNetworkStatus(sync)
  const tone = STATUS_TONES[networkStatus.tone]
  const networkName = status?.network === 'testnet' ? 'Testnet' : status?.network === 'mainnet' ? 'Mainnet' : null
  const tipHeight = sync?.tipHeight ?? 0
  const peerCount = sync?.peerCount ?? 0
  const syncActive = sync !== undefined && sync.phase !== 'stopped' && sync.phase !== 'idle'

  return (
    <div className={"relative overflow-hidden grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-10 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"absolute -top-14 -right-8 size-36 rounded-full bg-dash-brand/8 dark:bg-dash-mint/6 blur-3xl pointer-events-none"} />

      <div className={"flex items-center gap-2.5"}>
        <span className={"flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12 dash-text-primary"}>
          <WebIcon size={15} color={"currentColor"} />
        </span>
        <Text size={14} weight={"medium"} color={"brand"}>
          {labels.title}
        </Text>
        {networkName && (
          <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 ml-1 ${tone.pill}`}>
            <span className={`size-1.5 rounded-full ${tone.dot}`} />
            <Text size={12} weight={"medium"} className={`${tone.text} whitespace-nowrap`}>
              {networkName} · {networkStatus.label}
            </Text>
          </span>
        )}
      </div>

      <MiniStat label={labels.chainTip} value={tipHeight > 0 ? tipHeight.toLocaleString('en-US') : '—'} />
      <MiniStat label={labels.peers} value={syncActive ? peerCount.toLocaleString('en-US') : '—'} />
      <MiniStat label={labels.dataSource} value={describeDataSource(desiredConnection(), sync?.phase)} />
    </div>
  )
}
