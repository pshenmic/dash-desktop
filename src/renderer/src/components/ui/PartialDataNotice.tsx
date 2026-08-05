import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { PARTIAL_DATA_NOTICE } from '@renderer/constants'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'

export default function PartialDataNotice(): React.JSX.Element | null {
  const { dataIncomplete } = useConnectionModeContext()

  if (!dataIncomplete) return null

  return (
    <div className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 self-start"}>
      <span className={"size-1.5 rounded-full bg-dash-orange"} />
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{PARTIAL_DATA_NOTICE}</Text>
    </div>
  )
}
