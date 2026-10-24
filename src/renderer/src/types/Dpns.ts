import type { AliasDto, AliasSearchResultDto } from '@renderer/api/types'
import type { AliasPresentation, DpnsLabelIssue, DpnsLabelKind } from '@renderer/enums/DashPay'
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
  presentation: AliasPresentation
  isContested: boolean
  isPrimary: boolean
  alias: AliasDto | null
}

export interface UsernameAvailabilityInput {
  normalized: string
  identifier: string
  walletIdentifiers: ReadonlySet<string>
  results: AliasSearchResultDto[] | null
  loading: boolean
  error: string | null
}

export interface AliasPresentationSpec {
  label: string
  tone: StatusPillTone
  caption: string
}

export interface AliasSearchPage {
  query: string
  results: AliasSearchResultDto[]
}
