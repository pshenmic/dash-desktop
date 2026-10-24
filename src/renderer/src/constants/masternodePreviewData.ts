import type { Network } from '@renderer/api/types'
import {
  ContestStatus,
  MasternodeAccess,
  MasternodePreviewPreset,
  MasternodeStatus,
  MasternodeType,
  PreviewContestPhase,
} from '@renderer/enums/Masternodes'
import type {
  PreviewContestMix,
  PreviewNamedContestSpec,
  PreviewNodePresetSpec,
  PreviewNodeSpec,
  PreviewNodeVoteSpec,
  PreviewOurVoteMix,
  PreviewRange,
} from '@renderer/types/Preview'
import { DAY_MS, HOUR_MS } from './timeLeft'

export const PREVIEW_STEM_TOKEN = '{stem}'

export const PREVIEW_OPERATOR_NODES: PreviewNodeSpec[] = [
  { label: 'Northstar', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Aurora', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Zenith', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Halcyon', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Borealis', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Cosmos', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.WatchOnly, failNextVote: false },
  { label: 'Atlas', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Orbit', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Lumen', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Vega', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: true },
  { label: 'Nimbus', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Quasar', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Pulsar', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Comet', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Ember', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Drift', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Harbor', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Summit', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Beacon', type: MasternodeType.Regular, status: MasternodeStatus.PoseBanned, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Relay', type: MasternodeType.Regular, status: MasternodeStatus.PoseBanned, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Echo', type: MasternodeType.Regular, status: MasternodeStatus.NotListed, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Sentinel', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.WatchOnly, failNextVote: false },
  { label: 'Watchtower', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.WatchOnly, failNextVote: false },
  { label: 'Lookout', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.WatchOnly, failNextVote: false },
]

export const MASTERNODE_PREVIEW_PRESETS: Record<MasternodePreviewPreset, PreviewNodePresetSpec> = {
  [MasternodePreviewPreset.None]: { base: [], copies: 0 },
  [MasternodePreviewPreset.Operator]: { base: PREVIEW_OPERATOR_NODES, copies: 1 },
  [MasternodePreviewPreset.Large]: { base: PREVIEW_OPERATOR_NODES, copies: 5 },
}

export const PREVIEW_FIND_BY_KEY_NODES: PreviewNodeSpec[] = [
  { label: 'Meridian', type: MasternodeType.Evo, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Polaris', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
  { label: 'Rigel', type: MasternodeType.Regular, status: MasternodeStatus.Active, access: MasternodeAccess.VotingKey, failNextVote: false },
]

export const PREVIEW_NO_MATCH_WIF_SUFFIX = '1'

export const PREVIEW_NODE_PORTS: Record<Network, number> = {
  mainnet: 9999,
  testnet: 19999,
}

export const PREVIEW_CONTEST_MIX: PreviewContestMix = {
  open: 38,
  endingSoon: 5,
  joinOpen: 3,
  awarded: 64,
  locked: 12,
  noWinner: 6,
  minContenders: 1,
  maxContenders: 4,
}

export const PREVIEW_OUR_VOTE_MIX: PreviewOurVoteMix = {
  open: 8,
  openMixed: 2,
  openIssueNodeOnly: 1,
  ended: 4,
}

export const PREVIEW_NAMED_CONTESTS: PreviewNamedContestSpec[] = [
  { label: `${PREVIEW_STEM_TOKEN}-pay`, status: ContestStatus.Open, contenders: 2, walletContenderIndex: 0, walletVotes: 12, votesLock: 3, votesAbstain: 1 },
  { label: 'dash', status: ContestStatus.Open, contenders: 16, walletContenderIndex: null, walletVotes: 0, votesLock: 7, votesAbstain: 4 },
  { label: 'nova', status: ContestStatus.Awarded, contenders: 2, walletContenderIndex: 1, walletVotes: 4, votesLock: 1, votesAbstain: 0 },
  { label: 'vault', status: ContestStatus.Locked, contenders: 1, walletContenderIndex: 1, walletVotes: 2, votesLock: 9, votesAbstain: 0 },
  { label: 'kai', status: ContestStatus.NoWinner, contenders: 0, walletContenderIndex: null, walletVotes: 0, votesLock: 0, votesAbstain: 0 },
]

export const PREVIEW_NODE_VOTES: PreviewNodeVoteSpec[] = [
  { node: 'Orbit', contest: `${PREVIEW_STEM_TOKEN}-pay`, votesUsed: 4 },
  { node: 'Lumen', contest: 'dash', votesUsed: 5 },
]

export const PREVIEW_CONTENDER_NAMES = [
  'Alice Morgan', 'Nova Labs', 'Kai Chen', 'Vault Works', 'Dash Garden', 'Orbit Studio', 'River Co', 'Mira Patel',
  'Leo Grant', 'Ivy Brooks', 'Noah Reed', 'Zara Quinn', 'Owen Hale', 'Ada Stone', 'Eli Ford', 'Maya Lane',
]

export const PREVIEW_SEED_SALTS = {
  nodes: 'nodes',
  contests: 'contests',
  keyNodes: 'key-nodes',
} as const

export const PREVIEW_HEX_ALPHABET = '0123456789abcdef'

export const PREVIEW_BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export const PREVIEW_PROTX_HASH_LENGTH = 64

export const PREVIEW_IDENTIFIER_LENGTH = 44

export const PREVIEW_NODE_COPY_SEPARATOR = ' '

export const PREVIEW_NO_MATCH_PROTX_SUFFIX = '0'

export const PREVIEW_WATCHED_NODE: PreviewNodeSpec = {
  label: 'Node',
  type: MasternodeType.Regular,
  status: MasternodeStatus.Active,
  access: MasternodeAccess.WatchOnly,
  failNextVote: false,
}

export const PREVIEW_CHAIN_HEIGHT: Record<Network, number> = {
  mainnet: 2_350_000,
  testnet: 1_350_000,
}

export const PREVIEW_REGISTERED_AGE_BLOCKS: PreviewRange = { min: 20_000, max: 400_000 }

export const PREVIEW_LAST_PAID_AGE_BLOCKS: PreviewRange = { min: 10, max: 4_000 }

export const PREVIEW_BANNED_POSE_PENALTY: PreviewRange = { min: 2_000, max: 4_000 }

export const PREVIEW_NODE_ADDED_AGE_MS: PreviewRange = { min: DAY_MS, max: 90 * DAY_MS }

export const PREVIEW_IPV4_OCTETS: PreviewRange[] = [
  { min: 11, max: 223 },
  { min: 0, max: 255 },
  { min: 0, max: 255 },
  { min: 1, max: 254 },
]

export const PREVIEW_IPV4_SEPARATOR = '.'

export const PREVIEW_FALLBACK_STEM = 'alice'

export const PREVIEW_CONTEST_WORDS = [
  'amber', 'apple', 'arrow', 'aspen', 'birch', 'blaze', 'breeze', 'canyon', 'cedar', 'cobalt', 'coral',
  'delta', 'ember', 'falcon', 'fern', 'flint', 'frost', 'garnet', 'glade', 'harbor', 'hazel', 'indigo',
  'jasper', 'juniper', 'lotus', 'maple', 'meadow', 'mesa', 'onyx', 'opal', 'orchid', 'pebble', 'pine',
  'quartz', 'raven', 'ridge', 'sage', 'sierra', 'spruce', 'summit', 'thistle', 'tundra', 'willow', 'zephyr',
]

export const PREVIEW_CONTEST_SUFFIXES = ['', '-pay', '-shop', '-hub', '-labs']

export const PREVIEW_NAMED_OPEN_PROGRESS = 0.4

export const PREVIEW_PROGRESS_MARGIN = 0.05

export const PREVIEW_ENDED_AGE_MS: PreviewRange = { min: HOUR_MS, max: 60 * DAY_MS }

export const PREVIEW_CONTENDER_VOTES: PreviewRange = { min: 0, max: 120 }

export const PREVIEW_LOCK_VOTES: PreviewRange = { min: 0, max: 20 }

export const PREVIEW_ABSTAIN_VOTES: PreviewRange = { min: 0, max: 12 }

export const PREVIEW_UNNAMED_CONTENDER_RATE = 0.15

export const PREVIEW_CAPITALIZED_LABEL_RATE = 0.1

export const PREVIEW_OPEN_CONTEST_VOTERS = 3

export const PREVIEW_ENDED_CONTEST_VOTERS = 2

export const PREVIEW_CONTEST_PHASE_STATUS: Record<PreviewContestPhase, ContestStatus> = {
  [PreviewContestPhase.JoinOpen]: ContestStatus.Open,
  [PreviewContestPhase.Running]: ContestStatus.Open,
  [PreviewContestPhase.EndingSoon]: ContestStatus.Open,
  [PreviewContestPhase.Awarded]: ContestStatus.Awarded,
  [PreviewContestPhase.Locked]: ContestStatus.Locked,
  [PreviewContestPhase.NoWinner]: ContestStatus.NoWinner,
}
