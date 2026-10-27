import { Text } from '@renderer/components/dash-ui-kit-extended'
import Spinner from '@renderer/components/ui/Spinner'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import type { PendingRowProps } from '@renderer/types/PendingRow'

export default function PendingRow({ label, className = '' }: PendingRowProps): React.JSX.Element {
  return (
    <div role={"status"} className={`flex items-center gap-2 ${SURFACE_SECTION} ${className}`}>
      <Spinner size={14} className={"shrink-0"} />
      <Text size={14} weight={"medium"} color={"brand"}>{label}</Text>
    </div>
  )
}
