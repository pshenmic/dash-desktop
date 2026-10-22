import type { Network } from '@renderer/api/types'
import type { ContestSegment, ContestStatus, MasternodeAccess, MasternodeStatus, MasternodeType, NodeSegment, VoteChoiceKind } from '@renderer/enums/Masternodes'
import type { StatusPillTone } from '@renderer/enums/StatusPillTone'

export interface MasternodeDto {
  proTxHash: string
  label: string
  type: MasternodeType
  status: MasternodeStatus
  posePenalty: number
  service: string
  registeredHeight: number
  lastPaidHeight: number | null
  payoutAddress: string
  access: MasternodeAccess
  addedAt: number
}

export interface ContestContenderDto {
  identifier: string
  displayName: string | null
  requestedLabel: string
  votes: number
  requestedAt: number
}

export interface NameContestDto {
  normalizedLabel: string
  label: string
  status: ContestStatus
  contenders: ContestContenderDto[]
  votesLock: number
  votesAbstain: number
  startedAt: number
  joinClosesAt: number
  endsAt: number
  winnerId: string | null
}

export interface VoteChoiceDto {
  kind: VoteChoiceKind
  identifier: string | null
}

export interface MasternodeVoteDto {
  proTxHash: string
  normalizedLabel: string
  choice: VoteChoiceDto
  votesUsed: number
  castAt: number
}

export interface MasternodeVoteResultDto {
  proTxHash: string
  ok: boolean
  error: string | null
}

export type NodeSegmentCounts = Record<NodeSegment, number>

export interface ContestSegmentCounts {
  segments: Record<ContestSegment, number>
  yourNames: number
}

export interface ContestLeader {
  choice: VoteChoiceDto | null
  contender: ContestContenderDto | null
  votes: number
  share: number
  tie: boolean
}

export interface VotingPowerSummary {
  votes: number
  evonodes: number
  masternodes: number
}

export interface ContenderShare {
  contender: ContestContenderDto
  share: number
  leading: boolean
}

export interface VoteShare {
  votes: number
  share: number
}

export interface ContestShares {
  contenders: ContenderShare[]
  lock: VoteShare
  abstain: VoteShare
  total: number
}

export interface ContestVoteSummary {
  choice: VoteChoiceDto | null
  nodes: number
  mixed: boolean
}

export interface ContestFilter {
  query: string
  segment: ContestSegment
  yourNamesOnly: boolean
}

export interface ContestContext {
  nodes: MasternodeDto[]
  votes: MasternodeVoteDto[]
  walletIdentifiers: ReadonlySet<string>
  now: number
  network: Network
}

export interface StatusPillLabel {
  tone: StatusPillTone
  label: string
}

export interface WifRule {
  prefixes: string[]
  lengths: number[]
}
