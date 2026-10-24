export type AliasStatus = 'pending' | 'registered' | 'voting' | 'locked' | 'taken' | 'missing'

// Platform's ContestedDocumentVotePollWinnerInfo variants.
export type AliasVoteOutcome = 'WonByIdentity' | 'Locked' | 'NoWinner'

export interface AliasVote {
  contenders: Array<{identifier: string; votes: number}>
  lockVotes: number
  abstainVotes: number
  outcome: AliasVoteOutcome | null
  winner: string | null
  endsAt: number | null
}

export interface AliasCheck {
  status: Exclude<AliasStatus, 'pending'>
  isContested: boolean
  documentId: string | null
  votesFor: number | null
  votesLock: number | null
  votesAbstain: number | null
  voteEndsAt: number | null
}

export interface Alias extends Omit<AliasCheck, 'status'> {
  walletId: string
  identifier: string
  label: string
  normalizedLabel: string
  status: AliasStatus
  preorderSalt: Uint8Array | null
  createdAt: number
  checkedAt: number | null
}

// A DPNS name and the identity that owns it, from a prefix search.
export interface AliasSearchResult {
  identifier: string
  name: string
}
