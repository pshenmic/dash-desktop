import type { Network } from '@renderer/api/types'
import { UsernamePresentation, UsernameStatus, DpnsLabelIssue } from '@renderer/enums/DashPay'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { UsernamePresentationSpec } from '@renderer/types/Dpns'

export const DPNS_PARENT_DOMAIN = 'dash'

export const DPNS_NAME_SUFFIX = `.${DPNS_PARENT_DOMAIN}`

export const DPNS_HANDLE_PREFIX = '@'

export const DPNS_WHITESPACE_PATTERN = /\s+/g

export const DPNS_LABEL_MIN = 3

export const DPNS_LABEL_MAX = 63

export const DPNS_LABEL_PATTERN = /^[a-zA-Z0-9-]+$/

export const DPNS_EDGE_HYPHEN = '-'

export const DPNS_CONTESTED_PATTERN = /^[a-zA-Z01-]{3,19}$/

export const DPNS_HOMOGRAPH_MAP: Record<string, string> = {
  o: '0',
  i: '1',
  l: '1',
}

export const DPNS_LABEL_MESSAGES: Record<DpnsLabelIssue, string> = {
  [DpnsLabelIssue.TooShort]: 'Use at least 3 characters',
  [DpnsLabelIssue.TooLong]: 'Use at most 63 characters',
  [DpnsLabelIssue.InvalidChars]: 'Use only letters, numbers and hyphens',
  [DpnsLabelIssue.EdgeHyphen]: 'Can’t start or end with a hyphen',
}

export const USERNAME_PRESENTATION: Record<UsernamePresentation, UsernamePresentationSpec> = {
  [UsernamePresentation.Registered]: { label: 'Registered', tone: StatusPillTone.Success, caption: 'Registered' },
  [UsernamePresentation.Voting]: { label: 'In vote', tone: StatusPillTone.Accent, caption: 'Vote in progress' },
  [UsernamePresentation.Locked]: { label: 'Locked', tone: StatusPillTone.Danger, caption: 'Blocked by masternode vote' },
  [UsernamePresentation.Taken]: { label: 'Taken', tone: StatusPillTone.Inactive, caption: 'Given to another identity by vote' },
  [UsernamePresentation.Missing]: { label: 'Not registered', tone: StatusPillTone.Inactive, caption: 'The name is open again' },
}

export const USERNAME_STATUS_PRESENTATION: Record<UsernameStatus, UsernamePresentation> = {
  [UsernameStatus.Registered]: UsernamePresentation.Registered,
  [UsernameStatus.Voting]: UsernamePresentation.Voting,
  [UsernameStatus.Locked]: UsernamePresentation.Locked,
  [UsernameStatus.Taken]: UsernamePresentation.Taken,
  [UsernameStatus.Missing]: UsernamePresentation.Missing,
}

export const WALLET_USERNAME_CLAIM_STATUSES: UsernameStatus[] = [UsernameStatus.Registered, UsernameStatus.Voting, UsernameStatus.Locked]

export const USERNAME_ORDER: UsernamePresentation[] = [
  UsernamePresentation.Voting,
  UsernamePresentation.Registered,
  UsernamePresentation.Taken,
  UsernamePresentation.Locked,
  UsernamePresentation.Missing,
]

export const USERNAME_CAPTION_COPY = {
  separator: ' · ',
  endsIn: 'Ends in',
  voteEnded: 'Voting ended',
  forYou: 'for you',
  lock: 'lock',
  abstain: 'abstain',
} as const

export const VOTE_POLL_DURATION_MS: Record<Network, number> = {
  mainnet: 1_209_600_000,
  testnet: 5_400_000,
}

export const CONTEST_JOIN_WINDOW_MS: Record<Network, number> = {
  mainnet: 604_800_000,
  testnet: 2_700_000,
}

export const VOTE_POLL_DURATION_LABEL: Record<Network, string> = {
  mainnet: '14 days',
  testnet: '90 minutes',
}
