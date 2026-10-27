import type { UsernameContenderDto, UsernameDto, UsernameSearchResultDto } from '@renderer/api/types'
import type { UsernamePresentation, DpnsLabelIssue, DpnsLabelKind } from '@renderer/enums/DashPay'
import type { StatusPillTone } from '@renderer/enums/StatusPillTone'

export interface DpnsLabelCheck {
  issue: DpnsLabelIssue | null
  label: string
  normalized: string
  kind: DpnsLabelKind
}

export interface UsernameRowModel {
  label: string
  normalizedLabel: string
  fullName: string
  presentation: UsernamePresentation
  isContested: boolean
  isPrimary: boolean
  username: UsernameDto | null
}

export interface UsernameAvailabilityInput {
  normalized: string
  identifier: string
  walletIdentifiers: ReadonlySet<string>
  walletUsernames: UsernameDto[]
  results: UsernameSearchResultDto[] | null
  loading: boolean
  error: string | null
}

export interface ContestStanding extends UsernameContenderDto {
  isOwn: boolean
}

export interface UsernamePresentationSpec {
  label: string
  tone: StatusPillTone
  caption: string
}

export interface UsernameSearchPage {
  query: string
  results: UsernameSearchResultDto[]
}
