export type UsernameStatus = 'registered' | 'voting' | 'locked' | 'taken' | 'missing'

// Platform's ContestedDocumentVotePollWinnerInfo variants.
export type UsernameVoteOutcome = 'WonByIdentity' | 'Locked' | 'NoWinner'

export interface UsernameVote {
  contenders: Array<{identifier: string; votes: number}>
  lockVotes: number
  abstainVotes: number
  outcome: UsernameVoteOutcome | null
  winner: string | null
  endsAt: number | null
}

export interface UsernameCheck {
  status: UsernameStatus
  isContested: boolean
  documentId: string | null
  votesLock: number | null
  votesAbstain: number | null
  voteEndsAt: number | null
  voteOutcome: UsernameVoteOutcome | null
  voteWinner: string | null
  // Empty for an uncontested name.
  contenders: UsernameVote['contenders']
}

export interface Username extends UsernameCheck {
  identifier: string
  label: string
  normalizedLabel: string
}

// A DPNS name and the identity that owns it, from a prefix search.
export interface UsernameSearchResult {
  identifier: string
  name: string
}
