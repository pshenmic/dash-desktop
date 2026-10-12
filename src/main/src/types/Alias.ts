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
