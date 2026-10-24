import type { Network } from '@renderer/api/types'
import { AliasPresentation, AliasStatus, DpnsLabelIssue } from '@renderer/enums/DashPay'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { AliasPresentationSpec } from '@renderer/types/Dpns'

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

export const ALIAS_PRESENTATION: Record<AliasPresentation, AliasPresentationSpec> = {
  [AliasPresentation.Registered]: { label: 'Registered', tone: StatusPillTone.Success, caption: 'Registered' },
  [AliasPresentation.Pending]: { label: 'Registering', tone: StatusPillTone.Warning, caption: 'Waiting for the network' },
  [AliasPresentation.Voting]: { label: 'In vote', tone: StatusPillTone.Accent, caption: 'Vote in progress' },
  [AliasPresentation.Locked]: { label: 'Locked', tone: StatusPillTone.Danger, caption: 'Blocked by masternode vote' },
  [AliasPresentation.Taken]: { label: 'Taken', tone: StatusPillTone.Inactive, caption: 'Given to another identity by vote' },
  [AliasPresentation.Resumable]: { label: 'Incomplete', tone: StatusPillTone.Warning, caption: 'Preorder paid · registration didn’t finish' },
  [AliasPresentation.Missing]: { label: 'Not registered', tone: StatusPillTone.Inactive, caption: 'The name is open again' },
}

export const ALIAS_STATUS_PRESENTATION: Record<AliasStatus, AliasPresentation> = {
  [AliasStatus.Pending]: AliasPresentation.Pending,
  [AliasStatus.Registered]: AliasPresentation.Registered,
  [AliasStatus.Voting]: AliasPresentation.Voting,
  [AliasStatus.Locked]: AliasPresentation.Locked,
  [AliasStatus.Taken]: AliasPresentation.Taken,
  [AliasStatus.Missing]: AliasPresentation.Missing,
}

export const USERNAME_ORDER: AliasPresentation[] = [
  AliasPresentation.Resumable,
  AliasPresentation.Voting,
  AliasPresentation.Pending,
  AliasPresentation.Registered,
  AliasPresentation.Taken,
  AliasPresentation.Locked,
  AliasPresentation.Missing,
]

export const USERNAME_CAPTION_COPY = {
  separator: ' · ',
  added: 'Added',
  checked: 'checked',
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
