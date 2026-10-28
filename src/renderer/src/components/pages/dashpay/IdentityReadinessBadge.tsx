import CustomBadge from '@renderer/components/ui/CustomBadge'
import { DASHPAY_READINESS_BADGES } from '@renderer/constants/dashPay'
import type { IdentityReadinessBadgeProps } from '@renderer/types/DashPayOverview'

export default function IdentityReadinessBadge({ readiness }: IdentityReadinessBadgeProps): React.JSX.Element {
  const badge = DASHPAY_READINESS_BADGES[readiness]
  return <CustomBadge variant={badge.variant} text={badge.text} className={'shrink-0 whitespace-nowrap'} />
}
