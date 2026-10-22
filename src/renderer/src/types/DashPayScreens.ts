import type { DashPayContactDto } from '@renderer/api/types'
import type { ContactSegment, ContactSort, DashPayTab } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DashPayReadinessInfo } from './DashPay'

export interface DashPayPageProps {
  walletId: string
}

export interface OverviewTabProps {
  walletId: string
  identity: IdentityApiDto | null
  identities: IdentityApiDto[]
  readiness: DashPayReadinessInfo | null
  loading: boolean
  now: number
  onSwitchIdentity: () => void
  onOpenSection: (tab: DashPayTab, segment?: ContactSegment) => void
}

export interface ContactsTabProps {
  walletId: string
  identity: IdentityApiDto
  identities: IdentityApiDto[]
  readiness: DashPayReadinessInfo
  now: number
  segment: ContactSegment
  onSegmentChange: (segment: ContactSegment) => void
  query: string
  onQueryChange: (query: string) => void
  sort: ContactSort
  onSortChange: (sort: ContactSort) => void
  visibleCount: number
  onShowMore: () => void
  onOpenContact: (contactId: string) => void
}

export interface ContactDetailProps {
  walletId: string
  identity: IdentityApiDto
  identities: IdentityApiDto[]
  contactId: string
  now: number
  paymentsVisibleCount: number
  onShowMorePayments: () => void
  onBack: () => void
  onActAs: (identifier: string) => void
}

export interface AcceptRequestModalProps {
  open: boolean
  onClose: () => void
  contact: DashPayContactDto
  identity: IdentityApiDto
  onPay?: (contact: DashPayContactDto) => void
}

export interface PayContactModalProps {
  open: boolean
  onClose: () => void
  contact: DashPayContactDto
  identity: IdentityApiDto
}

export interface DashPayWizardProps {
  walletId: string
}

export type AddContactProps = DashPayWizardProps

export type RegisterUsernameProps = DashPayWizardProps

export interface UsernamesTabProps {
  walletId: string
  identity: IdentityApiDto
  readiness: DashPayReadinessInfo
  now: number
}

export interface EnableDashPayModalProps {
  open: boolean
  onClose: () => void
  identity: IdentityApiDto
}
