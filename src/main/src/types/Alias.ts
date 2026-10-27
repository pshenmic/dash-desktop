export type AliasStatus = 'registered' | 'voting' | 'locked' | 'taken' | 'missing'

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
  status: AliasStatus
  isContested: boolean
  documentId: string | null
  votesLock: number | null
  votesAbstain: number | null
  voteEndsAt: number | null
  voteOutcome: AliasVoteOutcome | null
  voteWinner: string | null
  // Empty for an uncontested name.
  contenders: AliasVote['contenders']
}

export interface Alias extends AliasCheck {
  identifier: string
  label: string
  normalizedLabel: string
}

// A DPNS name and the identity that owns it, from a prefix search.
export interface AliasSearchResult {
  identifier: string
  name: string
}
