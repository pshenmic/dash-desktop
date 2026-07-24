import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'

export default function P2pSyncAlert(): React.JSX.Element {
  return (
    <div className={"flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10"}>
      <div className={"flex flex-col gap-[.375rem]"}>
        <div className={"flex items-center gap-2"}>
          <ExclamationIcon size={16} className={"text-dash-orange"} />
          <Text size={14} weight={"extrabold"} className={"text-dash-orange!"}>Waiting for P2P sync</Text>
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          Sending from Dash Core (L1) is unavailable while the wallet is syncing over P2P. Wait until synchronization completes, or switch the connection mode to Dash Insight API (RPC).
        </Text>
      </div>
    </div>
  )
}
