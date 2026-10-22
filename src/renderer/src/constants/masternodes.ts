import type { Network } from '@renderer/api/types'
import {
  ContestSegment,
  ContestSort,
  ContestStatus,
  MasternodeAccess,
  MasternodesTab,
  MasternodeStatus,
  MasternodeType,
  NodeSegment,
  NodeVoteEligibility,
  VoteChoiceKind,
  VotingKeyInputKind,
} from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { StatusPillLabel, WifRule } from '@renderer/types/Masternodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'

export const MASTERNODE_VOTE_WEIGHT: Record<MasternodeType, number> = {
  [MasternodeType.Regular]: 1,
  [MasternodeType.Evo]: 4,
}

export const VOTES_PER_NODE_PER_POLL = 5

export const MASTERNODE_PARAMS = {
  tab: 'tab',
  segment: 'segment',
  contest: 'contest',
  node: 'node',
} as const

export const ENDING_SOON_MS: Record<Network, number> = {
  mainnet: 86_400_000,
  testnet: 900_000,
}

export const CONTENDER_SEARCH_MIN = 8

export const VOTE_NODE_SEARCH_MIN = 8

export const MASTERNODES_PAGE_SIZE = 50

export const CONTESTS_PAGE_SIZE = 50

export const NODE_VOTES_PAGE_SIZE = 50

export const MASTERNODE_TABLE_GRID = 'grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_3.5rem_1rem]'

export const CONTEST_TABLE_GRID = 'grid-cols-[minmax(0,1.2fr)_7rem_minmax(0,1.4fr)_6rem_minmax(0,1fr)_1rem]'

export const MASTERNODES_TAB_LABELS: Record<MasternodesTab, string> = {
  [MasternodesTab.Contests]: 'Name contests',
  [MasternodesTab.Nodes]: 'Nodes',
}

export const MASTERNODE_TYPE_BADGES: Record<MasternodeType, Pick<CustomBadgeProps, 'variant' | 'text'>> = {
  [MasternodeType.Regular]: { variant: 'muted', text: 'Masternode' },
  [MasternodeType.Evo]: { variant: 'accent', text: 'Evonode' },
}

export const MASTERNODE_STATUS_PILLS: Record<MasternodeStatus, StatusPillLabel> = {
  [MasternodeStatus.Active]: { tone: StatusPillTone.Success, label: 'Active' },
  [MasternodeStatus.PoseBanned]: { tone: StatusPillTone.Danger, label: 'PoSe banned' },
  [MasternodeStatus.NotListed]: { tone: StatusPillTone.Inactive, label: 'Not in list' },
}

export const CONTEST_STATUS_PILLS: Record<ContestStatus, StatusPillLabel> = {
  [ContestStatus.Open]: { tone: StatusPillTone.Accent, label: 'Open' },
  [ContestStatus.Awarded]: { tone: StatusPillTone.Success, label: 'Awarded' },
  [ContestStatus.Locked]: { tone: StatusPillTone.Danger, label: 'Locked' },
  [ContestStatus.NoWinner]: { tone: StatusPillTone.Inactive, label: 'No winner' },
}

export const MASTERNODE_ACCESS_LABELS: Record<MasternodeAccess, string> = {
  [MasternodeAccess.VotingKey]: 'Voting key',
  [MasternodeAccess.WatchOnly]: 'Watch only',
}

export const NODE_ELIGIBILITY_LABELS: Record<NodeVoteEligibility, string> = {
  [NodeVoteEligibility.Eligible]: 'Can vote',
  [NodeVoteEligibility.NoKey]: 'No voting key',
  [NodeVoteEligibility.Banned]: 'PoSe banned',
  [NodeVoteEligibility.NotListed]: 'Not in the masternode list',
  [NodeVoteEligibility.NoVotesLeft]: 'No votes left',
  [NodeVoteEligibility.SameChoice]: 'Already voted this way',
  [NodeVoteEligibility.Ended]: 'Voting ended',
}

export const VOTE_CHOICE_LABELS: Record<VoteChoiceKind, string> = {
  [VoteChoiceKind.TowardsIdentity]: 'Contender',
  [VoteChoiceKind.Lock]: 'Lock',
  [VoteChoiceKind.Abstain]: 'Abstain',
}

export const VOTING_KEY_MESSAGES: Record<VotingKeyInputKind, string> = {
  [VotingKeyInputKind.Empty]: '',
  [VotingKeyInputKind.Valid]: 'Looks good',
  [VotingKeyInputKind.WrongNetwork]: 'This key is for',
  [VotingKeyInputKind.Address]: 'That’s an address — enter the private key in WIF format',
  [VotingKeyInputKind.Hex]: 'That’s a hex key — enter it in WIF format',
  [VotingKeyInputKind.Invalid]: 'Not a valid private key',
}

export const OTHER_NETWORK: Record<Network, Network> = {
  mainnet: 'testnet',
  testnet: 'mainnet',
}

export const WIF_RULES: Record<Network, WifRule> = {
  mainnet: { prefixes: ['X', '7'], lengths: [51, 52] },
  testnet: { prefixes: ['c', '9'], lengths: [51, 52] },
}

export const ADDRESS_RULES: Record<Network, WifRule> = {
  mainnet: { prefixes: ['X', '7'], lengths: [34] },
  testnet: { prefixes: ['y', '8', '9'], lengths: [34] },
}

export const HEX_32_BYTE_PATTERN = /^[0-9a-fA-F]{64}$/

export const CONTEST_SEGMENT_LABELS: Record<ContestSegment, string> = {
  [ContestSegment.Open]: 'Open',
  [ContestSegment.NotVoted]: 'Not voted',
  [ContestSegment.EndingSoon]: 'Ending soon',
  [ContestSegment.Ended]: 'Ended',
}

export const NODE_SEGMENT_LABELS: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'All',
  [NodeSegment.CanVote]: 'Can vote',
  [NodeSegment.WatchOnly]: 'Watch-only',
  [NodeSegment.Issues]: 'Issues',
}

export const CONTEST_SORT_OPTIONS: SegmentOption<ContestSort>[] = [
  { value: ContestSort.EndingSoon, label: 'Ending soonest' },
  { value: ContestSort.MostVotes, label: 'Most votes' },
  { value: ContestSort.Name, label: 'Name A–Z' },
  { value: ContestSort.Newest, label: 'Newest' },
]

export const ENDED_CONTEST_SORT_OPTIONS: SegmentOption<ContestSort>[] = [
  { value: ContestSort.EndingSoon, label: 'Recently ended' },
  { value: ContestSort.Name, label: 'Name A–Z' },
]

export const CONTEST_TIMING_COPY = {
  joinUntil: 'New contenders until',
  joinClosed: 'New contenders can’t join',
  votesCast: 'votes cast',
  ended: 'Voting ended',
  separator: ' · ',
} as const

export const MASTERNODES_ROUTE = '/masternodes'

export const MASTERNODE_CACHE_NAMESPACES = {
  nodes: 'masternodes',
  contests: 'name-contests',
  votes: 'masternode-votes',
} as const

export const MASTERNODE_LOAD_ERRORS = {
  nodes: 'Failed to load masternodes',
  contests: 'Failed to load name contests',
  votes: 'Failed to load votes',
} as const
