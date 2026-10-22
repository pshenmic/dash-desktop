import type { Ref } from 'react'
import type { DashPayContactDto } from '@renderer/api/types'
import type { SearchResultState } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { CustomBadgeProps } from './CustomBadge'
import type { DashPayReadinessInfo } from './DashPay'
import type { IdentitySelectHandle } from './IdentitySelect'

export interface AddContactResultRow {
  identifier: string
  name: string | null
  extraNames: number
  state: SearchResultState
}

export interface AddContactRowContext {
  actingIdentifier: string
  contacts: DashPayContactDto[]
  walletIdentifiers: ReadonlySet<string>
}

export type SearchResultBadge = Pick<CustomBadgeProps, 'variant' | 'text'>

export interface AddContactFee {
  credits: bigint | null
  err: string | null
  retry: () => void
}

export interface AddContactSearchPanel {
  rows: AddContactResultRow[]
  capped: boolean
  loading: boolean
  err: string | null
  retry: () => void
}

export interface FindStepProps {
  identities: IdentityApiDto[]
  identity: IdentityApiDto
  readiness: DashPayReadinessInfo
  identitiesLoading: boolean
  identitiesError: string | null
  onRetryIdentities: () => void
  onSelectIdentity: (identifier: string) => void
  selectRef: Ref<IdentitySelectHandle>
  onEnable: () => void
  onSwitchIdentity: () => void
  query: string
  onQueryChange: (query: string) => void
  search: AddContactSearchPanel
  selectedId: string | null
  onSelectRow: (identifier: string) => void
  onOpenContact: (identifier: string) => void
  onAccept: (identifier: string) => void
}

export interface SearchResultRowProps {
  row: AddContactResultRow
  checked: boolean
  focusable: boolean
  acceptDisabled: boolean
  onSelect: (identifier: string) => void
  onOpenContact: (identifier: string) => void
  onAccept: (identifier: string) => void
}

export interface ConfirmStepProps {
  identity: IdentityApiDto
  target: AddContactResultRow
  fee: AddContactFee
  shortfall: bigint | null
}

export interface AddContactShortfallProps {
  identity: IdentityApiDto
  fee: AddContactFee
  shortfall: bigint | null
}

export interface AddContactCreditsProps {
  credits: bigint | null
}
