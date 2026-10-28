import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DashPayReadinessInfo } from './DashPay'

export interface ReadinessAlertProps {
  identity: IdentityApiDto
  readiness: DashPayReadinessInfo
  onEnable: () => void
}
