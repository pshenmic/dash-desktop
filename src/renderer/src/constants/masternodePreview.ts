import type { Network } from '@renderer/api/types'
import { MasternodePreviewPreset } from '@renderer/enums/Masternodes'

export const PREVIEW_DONE_NOTE = 'Preview · nothing was broadcast.'

export const PREVIEW_BADGE_COPY = {
  label: 'Preview',
  tooltip: 'Sample data. Nothing is sent.',
  sampleNodes: 'Sample nodes',
} as const

export const MASTERNODE_PREVIEW_PRESET_LABELS: Record<MasternodePreviewPreset, string> = {
  [MasternodePreviewPreset.None]: 'None',
  [MasternodePreviewPreset.Operator]: 'Operator',
  [MasternodePreviewPreset.Large]: 'Large',
}

export const DEFAULT_MASTERNODE_PREVIEW_PRESET = MasternodePreviewPreset.Operator

export const PREVIEW_LATENCY_MS = {
  read: 350,
  write: 900,
  vote: 300,
} as const

export const PREVIEW_BACKEND_ERRORS = {
  voteRejected: 'Vote not accepted by the network — try again',
  contestNotFound: 'This contest isn’t available',
} as const

export const PREVIEW_DEFAULT_NETWORK: Network = 'testnet'

export const PREVIEW_FNV = {
  offsetBasis: 2_166_136_261,
  prime: 16_777_619,
} as const

export const PREVIEW_LCG = {
  multiplier: 1_664_525,
  increment: 1_013_904_223,
  modulus: 4_294_967_296,
} as const
