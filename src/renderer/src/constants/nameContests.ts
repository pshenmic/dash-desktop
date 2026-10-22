import { ContestSegment, VoteChoiceKind } from '@renderer/enums/Masternodes'
import type { VoteChoiceDto } from '@renderer/types/Masternodes'
import { ListNavigationKey } from '@renderer/enums/ListNavigationKey'
import { PROGRESS_FILL, PROGRESS_TRACK } from './progressBar'
import { CHIP_ACTION, SURFACE_PANEL } from './surfaces'

export const CONTESTS_TAB_COPY = {
  searchPlaceholder: 'Search name',
  searchLabel: 'Search name contests',
  sortLabel: 'Sort contests',
  segmentsLabel: 'Contest status',
  yourNames: 'Your names',
  noNodesTitle: 'Add a node to vote',
  noNodesDescription: 'You can browse contests now.',
  addNode: 'Add masternode',
  noMatch: 'No contests match',
  clearSearch: 'Clear search',
} as const

export const CONTEST_TABLE_HEADINGS = ['Name', 'Contenders', 'Leading', 'Ends', 'Your vote'] as const

export const CONTEST_SEGMENT_EMPTY: Record<ContestSegment, string> = {
  [ContestSegment.Open]: 'No open contests',
  [ContestSegment.NotVoted]: 'Nothing left to vote on',
  [ContestSegment.EndingSoon]: 'No contests ending soon',
  [ContestSegment.Ended]: 'No ended contests',
}

export const CONTEST_ROW_COPY = {
  yourName: 'Your name',
  vote: 'vote',
  votes: 'votes',
  tie: 'Tie',
  none: '—',
  notVoted: 'Not voted',
  mixed: 'Mixed',
} as const

export const CONTEST_LIST_SEPARATOR = ' · '

export const CONTEST_AVATAR_LIMIT = 3

export const PERCENT_SCALE = 100

export const CONTEST_AVATAR_CLASS = 'ml-1 first:ml-0 rounded-full'

export const CONTEST_ROW_CHEVRON_CLASS = 'shrink-0 -rotate-90 dash-text-default'

export const YOUR_NAMES_CHIP_CLASS = `h-9 flex items-center ${CHIP_ACTION} rounded-[.625rem]! px-3! font-medium`

export const YOUR_NAMES_CHIP_PRESSED_CLASS = 'ring-1 ring-inset ring-dash-brand dark:ring-dash-mint'

export const SHARE_BAR_TRACK_CLASS = PROGRESS_TRACK

export const SHARE_BAR_FILL_CLASS = PROGRESS_FILL

export const CONTEST_DETAIL_COPY = {
  back: 'Back to name contests',
  backShort: 'Back',
  endsIn: 'Ends in',
  contenders: 'Contenders',
  votes: 'votes',
  searchContenders: 'Search contenders',
  choiceLabel: 'Your choice',
  leading: 'Leading',
  yourIdentity: 'Your identity',
  requestedAs: 'Requested as',
  openInDashPay: 'Open in DashPay',
  otherChoices: 'Other choices',
  lock: 'Lock — nobody gets this name',
  abstain: 'Abstain — supports no one',
  noContenderMatch: 'No contenders match',
  unknown: 'This contest isn’t available',
  yourVotes: 'Your votes',
} as const

export const CONTEST_OUTCOME_COPY = {
  awarded: 'Awarded to',
  locked: 'Locked by masternode vote',
  noWinner: 'No winner — the name is open again',
} as const

export const VOTE_PANEL_COPY = {
  title: 'Your vote',
  voteWith: 'Vote with',
  selectAll: 'Select all',
  searchNodes: 'Search nodes',
  votingPower: 'Voting power',
  currently: 'Currently',
  notVoted: 'Not voted',
  on: 'on',
  node: 'node',
  nodes: 'nodes',
  left: 'left',
  review: 'Review vote',
  noVotingTitle: 'No voting nodes',
  noVotingDescription: 'Add a node’s voting key to vote.',
  noNodeMatch: 'No nodes match',
  willHave: 'will have',
  oneChangeLeft: '1 change left',
  noChangesLeft: 'no changes left',
} as const

export const VOTE_CHANGE_WARNING_LEFT = 1

export const VOTE_MODAL_COPY = {
  title: 'Review vote',
  name: 'Name',
  choice: 'Choice',
  nodes: 'Nodes',
  votingPower: 'Voting power',
  fee: 'Fee',
  feeValue: 'None — paid from the contest fund',
  selected: 'selected',
  abstain: 'Abstain',
  cast: 'Cast',
  vote: 'vote',
  votes: 'votes',
  pending: 'Casting votes…',
  of: 'of',
  recorded: 'recorded',
  retry: 'Retry',
  failed: 'failed',
  ellipsis: '…',
  dash: ' — ',
} as const

export const VOTE_MODAL_NODE_PREVIEW = 3

export const CONTEST_DETAIL_GRID = 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,1fr)] gap-4 items-start'

export const VOTE_PANEL_CLASS = `flex flex-col gap-3 lg:sticky lg:top-6 ${SURFACE_PANEL}`

export const PANEL_DIVIDER_CLASS = 'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const VOTE_NODE_LIST_CLASS = 'flex flex-col gap-1.5'

export const VOTE_NODE_SCROLL_CLASS = 'flex flex-col gap-1.5 max-h-[18rem] overflow-y-auto scrollbar-hide'

export const VOTE_RESULTS_SCROLL_CLASS = 'mt-5 flex flex-col gap-1.5 max-h-[16rem] overflow-y-auto scrollbar-hide'

export const CONTENDER_OPTION_BASE = 'flex w-full min-w-0 items-center gap-3 rounded-[.875rem] border px-[.9375rem] py-[.625rem] text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40'

export const CONTENDER_OPTION_SELECTED = 'border-dash-brand bg-dash-brand/6 dark:border-dash-mint dark:bg-dash-mint/6'

export const CONTENDER_OPTION_IDLE = 'border-transparent dash-block enabled:cursor-pointer enabled:hover:border-dash-brand/50 dark:enabled:hover:border-dash-mint/50'

export const CONTENDER_OPTION_DISABLED = 'opacity-60'

export const RADIO_DOT_BASE = 'size-4 shrink-0 rounded-full'

export const RADIO_DOT_IDLE = 'border-2 border-dash-primary-dark-blue/30 dark:border-white/30'

export const RADIO_DOT_SELECTED = 'border-[5px] border-dash-brand dark:border-dash-mint'

export const RADIO_NAVIGATION_KEYS: Record<string, ListNavigationKey> = {
  ArrowDown: ListNavigationKey.ArrowDown,
  ArrowRight: ListNavigationKey.ArrowDown,
  ArrowUp: ListNavigationKey.ArrowUp,
  ArrowLeft: ListNavigationKey.ArrowUp,
  Home: ListNavigationKey.Home,
  End: ListNavigationKey.End,
}

export const LOCK_CHOICE: VoteChoiceDto = { kind: VoteChoiceKind.Lock, identifier: null }

export const ABSTAIN_CHOICE: VoteChoiceDto = { kind: VoteChoiceKind.Abstain, identifier: null }
