export enum MasternodesTab {
  Contests = 'contests',
  Nodes = 'nodes',
}

export enum MasternodeType {
  Regular = 'regular',
  Evo = 'evo',
}

export enum MasternodeStatus {
  Active = 'active',
  PoseBanned = 'pose-banned',
  NotListed = 'not-listed',
}

export enum MasternodeAccess {
  VotingKey = 'voting-key',
  WatchOnly = 'watch-only',
}

export enum NodeSegment {
  All = 'all',
  CanVote = 'can-vote',
  WatchOnly = 'watch-only',
  Issues = 'issues',
}

export enum ContestStatus {
  Open = 'open',
  Awarded = 'awarded',
  Locked = 'locked',
  NoWinner = 'no-winner',
}

export enum ContestSegment {
  Open = 'open',
  NotVoted = 'not-voted',
  EndingSoon = 'ending-soon',
  Ended = 'ended',
}

export enum ContestSort {
  EndingSoon = 'ending-soon',
  MostVotes = 'most-votes',
  Name = 'name',
  Newest = 'newest',
}

export enum VoteChoiceKind {
  TowardsIdentity = 'towards-identity',
  Lock = 'lock',
  Abstain = 'abstain',
}

export enum NodeVoteEligibility {
  Eligible = 'eligible',
  NoKey = 'no-key',
  Banned = 'banned',
  NotListed = 'not-listed',
  NoVotesLeft = 'no-votes-left',
  SameChoice = 'same-choice',
  Ended = 'ended',
}

export enum AddNodeSource {
  VotingKey = 'voting-key',
  WatchOnly = 'watch-only',
}

export enum AddNodePhase {
  Input = 'input',
  Finding = 'finding',
  Review = 'review',
  Adding = 'adding',
  Done = 'done',
}

export enum VotingKeyInputKind {
  Empty = 'empty',
  Valid = 'valid',
  WrongNetwork = 'wrong-network',
  Address = 'address',
  Hex = 'hex',
  Invalid = 'invalid',
}

export enum MasternodePreviewPreset {
  None = 'none',
  Operator = 'operator',
  Large = 'large',
}

export enum PreviewContestPhase {
  JoinOpen = 'join-open',
  Running = 'running',
  EndingSoon = 'ending-soon',
  Awarded = 'awarded',
  Locked = 'locked',
  NoWinner = 'no-winner',
}
