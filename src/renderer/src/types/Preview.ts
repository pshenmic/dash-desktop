import type { Network } from '@renderer/api/types'
import type { ContestStatus, MasternodeAccess, MasternodePreviewPreset, MasternodeStatus, MasternodeType } from '@renderer/enums/Masternodes'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { MasternodeDto, MasternodeVoteDto, NameContestDto } from './Masternodes'

export interface PreviewNodeSpec {
  label: string
  type: MasternodeType
  status: MasternodeStatus
  access: MasternodeAccess
  failNextVote: boolean
}

export interface PreviewNodePresetSpec {
  base: PreviewNodeSpec[]
  copies: number
}

export interface PreviewContestMix {
  open: number
  endingSoon: number
  joinOpen: number
  awarded: number
  locked: number
  noWinner: number
  minContenders: number
  maxContenders: number
}

export interface PreviewOurVoteMix {
  open: number
  openMixed: number
  openIssueNodeOnly: number
  ended: number
}

export interface PreviewNamedContestSpec {
  label: string
  status: ContestStatus
  contenders: number
  walletContenderIndex: number | null
  walletVotes: number
  votesLock: number
  votesAbstain: number
}

export interface PreviewNodeVoteSpec {
  node: string
  contest: string
  votesUsed: number
}

export interface PreviewWalletState {
  walletId: string
  network: Network
  seededAt: number
  nodes: MasternodeDto[]
  contests: NameContestDto[]
  votes: MasternodeVoteDto[]
  failNextVote: string[]
}

export type PreviewIdentity = Pick<IdentityApiDto, 'identifier' | 'identityIndex' | 'usernames'>

export interface PreviewWalletInput {
  walletId: string
  network: Network
  now: number
  preset: MasternodePreviewPreset
  identities: PreviewIdentity[]
}

export type PreviewSeedInput = Pick<PreviewWalletInput, 'network' | 'identities'>

export type PreviewRandom = () => number

export interface PreviewRange {
  min: number
  max: number
}

export type PreviewContestTiming = Pick<NameContestDto, 'startedAt' | 'joinClosesAt' | 'endsAt'>

export interface PreviewUpdate<R> {
  state: PreviewWalletState
  result: R
}
