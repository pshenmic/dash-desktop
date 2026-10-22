import type { IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import type { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export interface IdentityKeyVariantDefinition {
  variant: IdentityKeyVariant
  purpose: IdentityKeyPurpose
  securityLevel: IdentityKeySecurityLevel
  dashPayBound: boolean
  caption: string | null
}

export interface KeySelectionCheck {
  count: number
  atLimit: boolean
  overLimit: boolean
  empty: boolean
}

export interface KeyBoundsLabel {
  text: string
  isDashPay: boolean
}

export interface KeyTableRowProps {
  identityKey: IdentityKeyDto
}

export interface IdentityKeysSectionProps {
  identity: IdentityApiDto
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
  onDone: () => void
}

export interface AddKeysProps {
  walletId: string
  identifier: string
}

export interface KeysAddedResult {
  stHash: string
  count: number
}
