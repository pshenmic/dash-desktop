import { DashPayTab, UsernameAvailability } from '@renderer/enums/DashPay'
import { DASHPAY_PARAMS, DASHPAY_ROUTES } from './dashPay'
import { HIGHLIGHTED_IDENTIFIER_CLASS } from './identifier'
import type { CountForms } from '../types/CountForms'

export const USERNAMES_TAB_HREF = `${DASHPAY_ROUTES.root}?${DASHPAY_PARAMS.tab}=${DashPayTab.Usernames}`

export const USERNAME_TITLE_HEAD = 18

export const USERNAME_TITLE_TAIL = 10

export const USERNAME_TITLE_ELLIPSIS = '…'

export const USERNAME_MONOGRAM_MUTED_CLASS = 'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full dash-block-5 opacity-50'

export const USERNAME_SKELETON_ROW_CLASS = 'h-13 rounded-[.875rem]'

export const USERNAME_FIELD_CLASS = 'flex items-center gap-2 dash-block rounded-2xl px-5 py-3.5 border border-transparent focus-within:border-dash-brand dark:focus-within:border-dash-mint'

export const USERNAME_INPUT_CLASS = 'bg-transparent outline-none flex-1 min-w-0 text-2xl font-medium text-dash-primary-dark-blue dark:text-white placeholder:text-dash-primary-dark-blue/25 dark:placeholder:text-white/25'

export const USERNAME_DOCUMENT_ID_CLASS = `min-w-0 text-right text-xs! font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const USERNAME_CONTENDER_ID_CLASS = `min-w-0 text-left text-xs! font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const USERNAME_DIVIDER_CLASS = 'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const USERNAME_LIST_COPY = {
  heading: 'Usernames',
  register: 'Register username',
  needsKey: 'Needs an Authentication · High key',
  primary: 'Primary',
  primaryTooltip: 'Your oldest name is the one others see',
  contested: 'Contested',
  registerAgain: 'Register',
  open: 'Open',
  emptyTitle: 'No username yet',
  emptyDescription: 'A .dash name makes this identity easy to find.',
} as const

export const USERNAME_TYPE_COPY = {
  instant: 'Instant',
  contest: 'Name contest',
} as const

export const USERNAME_DETAIL_COPY = {
  name: 'Name',
  status: 'Status',
  identity: 'Identity',
  type: 'Type',
  documentId: 'Document ID',
  lock: 'Lock',
  abstain: 'Abstain',
  ends: 'Ends',
  newContenders: 'New contenders until',
  closed: 'Closed',
  voteEnded: 'Vote ended',
  outcome: 'Outcome',
  winner: 'Winner',
  contenders: 'Contenders',
  thisIdentity: 'This identity',
  register: 'Register',
  close: 'Close',
} as const

export const USERNAME_VOTE_OUTCOME_COPY = {
  wonByThisIdentity: 'Won by this identity',
  wonByOther: 'Won by another identity',
  locked: 'Locked by masternodes',
  noWinner: 'No winner',
} as const

export const REGISTER_USERNAME_STEPS = {
  username: 'Username',
  confirm: 'Confirm',
} as const

export const REGISTER_USERNAME_COPY = {
  forIdentity: 'For identity',
  username: 'Username',
  placeholder: 'yourname',
  fee: 'Fee',
  feeContested: 'Fee incl. voting deposit',
  identityBalance: 'Identity balance',
  balanceAfter: 'Balance after',
  noKeyTitle: 'Needs an Authentication · High key',
  noKeyDescription: 'Add one to this identity before registering a name.',
  addKeys: 'Add keys',
  submit: 'Register',
  noIdentities: 'No identity in this wallet',
  identitiesError: 'Failed to load identities',
} as const

export const USERNAME_CHECK_COPY = {
  checking: 'Checking…',
  available: 'Available',
  contested: 'Contested',
  instant: 'Instant',
  taken: 'is taken',
  owned: 'This identity already owns',
  ownedByWallet: 'in this wallet owns it',
  inContest: 'This identity is already in the vote for',
  inWalletContest: 'in this wallet is already in the vote for it',
  error: 'Couldn’t check availability',
  savedAs: 'Saved as',
  homographHint: 'o, i and l count as 0, 1 and 1',
  contestedTitle: 'Contested name',
  contestedLead: 'Masternodes vote',
  contestedFor: 'for',
  contestedTail: 'before it’s awarded. If someone already requested it, you join their contest.',
} as const

export const REGISTER_CONFIRM_COPY = {
  username: 'Username',
  savedAs: 'Saved as',
  for: 'For',
  type: 'Type',
} as const

export const REGISTER_SIGN_COPY = {
  title: 'Register username',
  confirm: 'Register',
  pending: 'Registering',
  toLabel: 'Username',
  noteRegistered: 'Your name is registered.',
  noteContestLead: 'Your request entered a name contest.',
  noteContestEnds: 'Voting ends in',
  identity: 'Identity',
  status: 'Status',
  documentId: 'Document ID',
} as const

export const REGISTER_ALLOWED_AVAILABILITY: UsernameAvailability[] = [UsernameAvailability.Available, UsernameAvailability.Error]

export const USERNAME_AVAILABILITY_BLOCKING: UsernameAvailability[] = [
  UsernameAvailability.Taken,
  UsernameAvailability.Owned,
  UsernameAvailability.OwnedByWallet,
  UsernameAvailability.InContest,
  UsernameAvailability.InWalletContest,
]

export const USERNAME_VOTE_FORMS: CountForms = { one: 'vote', other: 'votes' }
