import type { ReactNode, Ref } from 'react'
import type { DashPayContactDto } from '@renderer/api/types'
import type { ContactSegment, DashPayReadiness, DashPayTab, OverviewAction, OverviewBand } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { ContactSegmentCounts, DashPayReadinessInfo } from './DashPay'
import type { IdentitySelectHandle } from './IdentitySelect'

export interface IdentitySwitcherProps {
  identities: IdentityApiDto[]
  identity: IdentityApiDto | null
  contacts: DashPayContactDto[]
  loading: boolean
  err: string | null
  onRetry: () => void
  onSelect: (identifier: string) => void
  ref?: Ref<IdentitySelectHandle>
}

export interface IdentityReadinessBadgeProps {
  readiness: DashPayReadiness
}

export interface OverviewBandModel {
  kind: OverviewBand
  total: number
  rows: DashPayContactDto[]
}

export interface UsernameSummary {
  total: number
  inVote: number
}

export interface CountForms {
  one: string
  other: string
}

export interface OverviewHeroProps {
  identity: IdentityApiDto | null
  ready: boolean
  orbit: string[]
  body: string
  actions: ReactNode
}

export interface OverviewHeroArtProps {
  identity: IdentityApiDto | null
  orbit: string[]
}

export interface IdentityHeroContentProps {
  identity: IdentityApiDto
}

export interface OnboardingHeroContentProps {
  body: string
}

export interface SetupChecklistProps {
  identity: IdentityApiDto | null
  readiness: DashPayReadinessInfo | null
  canSwitch: boolean
  onAction: (action: OverviewAction) => void
  onTopUp: () => void
  onSwitchIdentity: () => void
}

export interface SetupStepActionProps {
  label: string
  disabled?: boolean
  tooltip?: string
  onClick: () => void
}

export interface ContactsSummaryProps {
  counts: ContactSegmentCounts
  usernames: UsernameSummary
  loading: boolean
  onOpenSection: (tab: DashPayTab, segment?: ContactSegment) => void
}

export interface ContactsSummaryRowProps {
  label: string
  value: number
  loading: boolean
  attention?: boolean
  onClick: () => void
}

export interface PreviewListProps {
  band: OverviewBandModel
  identity: IdentityApiDto
  walletIdentifiers: ReadonlySet<string>
  canSend: boolean
  now: number
  onViewAll: () => void
  onOpenContact: (contactId: string) => void
}

export interface EntryCardProps {
  icon: ReactNode
  title: string
  caption: string
  disabled?: boolean
  onClick: () => void
}
