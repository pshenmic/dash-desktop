import type { Network } from '@renderer/api/types'
import type { DpnsLabelIssue, UsernameAvailability } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DpnsLabelCheck, UsernameRowModel } from './Dpns'

export interface UsernameRowProps {
  row: UsernameRowModel
  now: number
  onOpen: (row: UsernameRowModel) => void
  onRegister: (row: UsernameRowModel) => void
  onViewContest?: (row: UsernameRowModel) => void
}

export interface UsernameDetailModalProps {
  open: boolean
  onClose: () => void
  row: UsernameRowModel | null
  identity: IdentityApiDto
  now: number
  network: Network | null
  onRegister: (row: UsernameRowModel) => void
  onViewContest?: (row: UsernameRowModel) => void
}

export interface UsernameDetailLine {
  label: string
  value: string
}

export interface UsernameFieldProps {
  value: string
  onChange: (value: string) => void
  invalid: boolean
}

export interface UsernameCheckProps {
  check: DpnsLabelCheck
  network: Network | null
  availability: UsernameAvailability
  ownerName: string | null
  onRetry: () => void
}

export interface RegisterFeeSummaryProps {
  feeLabel: string
  feeCredits: bigint | null
  balance: bigint
}

export interface RegisterConfirmStepProps {
  check: DpnsLabelCheck
  identity: IdentityApiDto
  network: Network | null
  feeLabel: string
  feeCredits: bigint | null
}

export interface RegisterGateInput {
  issue: DpnsLabelIssue | null
  canRegister: boolean
  availability: UsernameAvailability
  feeCredits: bigint | null
  feeReady: boolean
  balance: bigint
}
