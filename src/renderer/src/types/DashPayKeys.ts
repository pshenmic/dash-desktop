import type { ReactNode } from 'react'
import type { IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import type { IdentityKeyVariant } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DashPayReadinessInfo } from './DashPay'
import type { IdentityKeyVariantDefinition, KeySelectionCheck } from './IdentityKeys'

export interface ReadinessAlertProps {
  identity: IdentityApiDto
  readiness: DashPayReadinessInfo
  onEnable: () => void
  onSwitchIdentity?: () => void
}

export interface SlotMeterProps {
  used: number
  leftAfter?: number
  action?: ReactNode
}

export interface KeyTableRowProps {
  identityKey: IdentityKeyDto
}

export interface KeysShortfallInput {
  requested: number
  slotsLeft: number
  feeCredits: bigint | null
  feeError: string | null
  balance: bigint
}

export interface KeyVariantGroup {
  dashPayBound: boolean
  label: string
  definitions: IdentityKeyVariantDefinition[]
}

export interface KeyVariantListProps {
  existing: IdentityKeyDto[]
  selected: IdentityKeyVariant[]
  recommended: IdentityKeyVariant[]
  check: KeySelectionCheck
  onToggle: (variant: IdentityKeyVariant, checked: boolean) => void
}

export interface AddKeysConfirmStepProps {
  identity: IdentityApiDto
  requests: IdentityKeyRequestDto[]
  feeCredits: bigint | null
}

export interface AddKeysWizardProps {
  walletId: string
  identity: IdentityApiDto
  identities: IdentityApiDto[]
  identitiesLoading: boolean
  identitiesError: string | null
  onSelectIdentity: (identifier: string) => void
  onRetryIdentities: () => void
  usePreset: boolean
  onDone: () => void
}

export interface KeysAddedResult {
  stHash: string
  count: number
}
