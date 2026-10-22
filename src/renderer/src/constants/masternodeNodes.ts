import { AddNodeSource, MasternodePreviewPreset, NodeSegment } from '@renderer/enums/Masternodes'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { MASTERNODE_PREVIEW_PRESET_LABELS } from './masternodePreview'
import { SURFACE_PANEL, SURFACE_ROW } from './surfaces'

export const MASTERNODES_PAGE_COPY = {
  addNode: 'Add masternode',
  presetLabel: 'Sample nodes',
} as const

export const MASTERNODE_PRESET_OPTIONS: SegmentOption<MasternodePreviewPreset>[] = [
  MasternodePreviewPreset.None,
  MasternodePreviewPreset.Operator,
  MasternodePreviewPreset.Large,
].map(value => ({ value, label: MASTERNODE_PREVIEW_PRESET_LABELS[value] }))

export const SUMMARY_STRIP_CLASS = `mb-4 grid grid-cols-3 divide-x divide-dash-primary-dark-blue/8 dark:divide-white/12 ${SURFACE_PANEL}`

export const SUMMARY_CELL_CLASS = 'flex min-w-0 flex-col gap-1 px-4 first:pl-1.5'

export const SUMMARY_SKELETON_CLASS = 'mx-2 h-14 rounded-[.625rem] animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const SUMMARY_LINK_CLASS = 'cursor-pointer rounded-md hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40'

export const SUMMARY_COPY = {
  nodes: 'Nodes',
  votingPower: 'Voting power',
  openContests: 'Open contests',
  canVote: 'can vote',
  watchOnly: 'watch-only',
  notVoted: 'not voted',
  endingSoon: 'ending soon',
  addVotingKey: 'Add a voting key to vote',
  separator: ' · ',
  dot: '·',
} as const

export const NO_WALLET_IDENTIFIERS: ReadonlySet<string> = new Set()

export const COUNT_NOUNS = {
  vote: { one: 'vote', many: 'votes' },
  node: { one: 'node', many: 'nodes' },
  evonode: { one: 'evonode', many: 'evonodes' },
  masternode: { one: 'masternode', many: 'masternodes' },
} as const

export const NODE_WEIGHT_PREFIX = '×'

export const NO_VALUE_MARK = '—'

export const NODES_TAB_COPY = {
  searchPlaceholder: 'Label, ProTxHash or IP',
  searchLabel: 'Search nodes',
  segmentsLabel: 'Node filter',
  emptyTitle: 'No masternodes yet',
  emptyDescription: 'Add a node with its voting key to vote on contested usernames.',
  noMatch: 'No nodes match',
  clearSearch: 'Clear search',
} as const

export const NODE_TABLE_COLUMNS = ['Node', 'Status', 'Access', 'Votes'] as const

export const NODE_SEGMENT_EMPTY: Record<NodeSegment, string> = {
  [NodeSegment.All]: 'No nodes',
  [NodeSegment.CanVote]: 'No nodes can vote',
  [NodeSegment.WatchOnly]: 'No watch-only nodes',
  [NodeSegment.Issues]: 'No issues',
}

export const NODE_ROW_COPY = {
  added: 'Added',
  noVotingKey: 'No voting key',
  menuTitle: 'Node',
  open: 'Open',
  copy: 'Copy ProTxHash',
  remove: 'Remove',
} as const

export const NODE_DETAIL_COPY = {
  subtitleVoting: 'on contested usernames.',
  subtitleVotesPrefix: 'Votes',
  subtitleWatchOnly: 'Watch only — add its voting key to vote.',
  remove: 'Remove',
  addVotingKey: 'Add voting key',
  proTxHash: 'ProTxHash',
  type: 'Type',
  status: 'Status',
  service: 'Service',
  votingKey: 'Voting key',
  votingKeyStored: 'In this wallet',
  votingKeyMissing: 'Not added',
  registered: 'Registered',
  lastPaid: 'Last paid',
  neverPaid: 'Never',
  payoutAddress: 'Payout address',
  pose: 'PoSe',
  heightPrefix: '#',
  unknownNode: 'This node isn’t in your list',
  back: 'Back',
} as const

export const NODE_DETAIL_ROW_CLASS = 'flex min-w-0 items-center gap-[.625rem]'

export const NODE_DETAIL_ICON_CLASS = 'dash-text-primary'

export const NODE_VOTES_COPY = {
  title: 'Votes',
  empty: 'No votes yet',
  of: 'of',
  votesUsed: 'votes used',
} as const

export const NODE_VOTE_ROW_CLASS = `w-full min-h-13 text-left cursor-pointer transition-colors hover:dash-block-accent-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 ${SURFACE_ROW}`

export const NODE_VOTE_ROW_GRID ='grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_1rem] items-center gap-3'

export const ADD_NODE_SOURCE_OPTIONS: SegmentOption<AddNodeSource>[] = [
  { value: AddNodeSource.VotingKey, label: 'Voting key' },
  { value: AddNodeSource.WatchOnly, label: 'Watch only' },
]

export const ADD_NODE_COPY = {
  title: 'Add masternode',
  description: 'Add a node by its voting key to vote, or watch it without one.',
  sourceLabel: 'Add with',
  votingKeyLabel: 'Voting private key (WIF)',
  votingKeyPlaceholder: 'Paste the voting key',
  votingKeyHint: 'Only the voting key is needed — never the collateral or owner key.',
  proTxHashLabel: 'ProTxHash',
  proTxHashPlaceholder: '64 hex characters',
  proTxHashInvalid: 'Not a valid ProTxHash',
  cancel: 'Cancel',
  back: 'Back',
  findNodes: 'Find nodes',
  findNode: 'Find node',
  finding: 'Looking up the masternode list…',
  noKeyMatch: 'This key isn’t the voting key of any active masternode',
  noHashMatch: 'No masternode with this ProTxHash',
  useThisKey: 'use this key',
  usesThisKey: 'uses this key',
  found: 'found',
  expectedMismatch: 'This key isn’t the voting key of',
  alreadyAdded: 'Already added',
  votingPower: 'Voting power',
  access: 'Access',
  passwordHint: 'Your wallet password encrypts the voting key on this device.',
  add: 'Add',
  added: 'added',
  done: 'Done',
  lookupFailed: 'Lookup failed',
  addFailed: 'Add masternode failed',
} as const

export const ADD_NODE_INPUT_CLASS = 'h-14.25 rounded-[1.25rem] bg-transparent!'

export const ADD_NODE_FACT_ROW_CLASS = 'flex items-center justify-between gap-4'

export const ADD_NODE_CANDIDATES_CLASS ='flex max-h-60 flex-col gap-1.5 overflow-y-auto scrollbar-hide'

export const REMOVE_NODE_COPY = {
  titlePrefix: 'Remove',
  votingKeyDescription: 'Its voting key is deleted from this wallet. The node itself is not affected.',
  watchOnlyDescription: 'It stops being watched in this wallet. The node itself is not affected.',
  cancel: 'Cancel',
  remove: 'Remove',
  removed: 'Node removed',
  failed: 'Remove node failed',
} as const
