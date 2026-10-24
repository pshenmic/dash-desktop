import { Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { TRANSACTION_KIND_BADGES } from '@renderer/constants/transactionKindBadges'
import type { SourceBadgeProps } from '@renderer/types/DashboardStats'

export default function SourceBadge({ kind }: SourceBadgeProps): React.JSX.Element {
  const badge = TRANSACTION_KIND_BADGES[kind]
  return (
    <Tooltip label={badge.label}>
      <span className="inline-flex shrink-0" title="">
        <CustomBadge text={badge.text} size="s" className={`w-12 shrink-0 ${badge.className}`} />
      </span>
    </Tooltip>
  )
}
