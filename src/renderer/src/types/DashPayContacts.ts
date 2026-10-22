import type { ReactNode } from 'react'
import type { DashPayContactDto } from '@renderer/api/types'
import type { ContactAction, ContactSegment, ContactSort } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { ContactRowModel, ContactSegmentCounts } from './DashPay'

export interface ContactsToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  sort: ContactSort
  onSortChange: (sort: ContactSort) => void
  segment: ContactSegment
  onSegmentChange: (segment: ContactSegment) => void
  counts: ContactSegmentCounts
  canAdd: boolean
  onAdd: () => void
}

export interface AddContactButtonProps {
  canAdd: boolean
  onAdd: () => void
}

export interface ContactRowProps {
  model: ContactRowModel
  now: number
  canSend: boolean
  onOpen: (contactId: string) => void
  onAccept: (contact: DashPayContactDto) => void
  onPay: (contact: DashPayContactDto) => void
}

export interface ContactModalState {
  action: ContactAction
  contact: DashPayContactDto
  open: boolean
}

export interface ContactActionModalsProps {
  modal: ContactModalState | null
  contacts: DashPayContactDto[]
  identity: IdentityApiDto
  onModalChange: (modal: ContactModalState | null) => void
}

export interface ContactPaymentsProps {
  walletId: string
  identity: IdentityApiDto
  contact: DashPayContactDto
  contactName: string
  visibleCount: number
  onShowMore: () => void
  onPay: (() => void) | null
}

export interface FeeShortfallProps {
  feeError: boolean
  onRetry: () => void
  identityName: string
  missingCredits: bigint | null
  onTopUp: () => void
}

export interface ContactFactProps {
  label: string
  children: ReactNode
}
