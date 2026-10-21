import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import type { StatusChipProps } from '@renderer/types/StatusChip'

export default function StatusChip({ children, action, loading = false }: StatusChipProps): React.JSX.Element {
  return (
    <div role={"status"} className={"flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 self-start"}>
      {loading
        ? <Spinner size={12} className={"text-dash-brand dark:text-dash-mint"} />
        : <span className={"size-1.5 shrink-0 rounded-full bg-dash-orange"} />}
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        {children}
      </Text>
      {action}
    </div>
  )
}
