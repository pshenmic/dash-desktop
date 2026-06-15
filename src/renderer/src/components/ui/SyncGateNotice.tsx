import { Text } from '@renderer/components/dash-ui-kit-enxtended'

export default function SyncGateNotice({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <div className={`flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3 ${className}`}>
      <Text size={14} weight={"extrabold"} color={"brand"}>
        Waiting for P2P sync
      </Text>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        This action is unavailable while the wallet is syncing over P2P. Wait until synchronization
        completes, or switch the connection mode to Dash Insight API (RPC).
      </Text>
    </div>
  )
}
