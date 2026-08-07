import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'

export default function PartialDataNotice(): React.JSX.Element | null {
  const { syncIncomplete } = useConnectionModeContext()

  if (!syncIncomplete) return null

  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 self-start"}>
      <span className={"size-1.5 rounded-full bg-dash-orange"} />
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        Syncing over P2P — balances and transactions may be incomplete
      </Text>
    </div>
  )
}
