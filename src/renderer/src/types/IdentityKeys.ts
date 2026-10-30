import type { IdentityKeyDto, IdentityKeyRequestDto } from '@renderer/api/types'
import type { IdentityKeyAction, IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
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
  onAction: (identityKey: IdentityKeyDto, action: IdentityKeyAction) => void
}

export interface IdentityKeysSectionProps {
  walletId: string
  identity: IdentityApiDto
}

export interface IdentityKeyUpdateCopy {
  action: string
  title: string
  submit: string
  pending: string
  done: string
  warningTitle: string
  warning: string
}

export interface IdentityKeyNotice {
  title: string
  description: string
}

export interface PendingKeyAction {
  identityKey: IdentityKeyDto
  action: IdentityKeyAction
}

export interface UpdateKeyModalProps {
  walletId: string
  identity: IdentityApiDto
  pending: PendingKeyAction | null
  onClose: () => void
}

export interface PrivateKeysModalProps {
  open: boolean
  onClose: () => void
  walletId: string
  identity: IdentityApiDto
}

export interface KeyUpdateResult {
  stHash: string
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
