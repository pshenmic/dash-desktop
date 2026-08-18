import type {ChainStore} from '../ChainStore'
import type {PoolService} from '../PoolService'
import type {PersistedHeader} from './chainStore'

import type {Peer} from 'dash-core-p2p'

export interface HeaderRace {
  // Kept for logging only: a response is validated by connecting it to the
  // recent-header window, not by matching what we asked for.
  locator: string[]
  racers: Set<Peer>
  zeroResponses: number
  timer: ReturnType<typeof setTimeout> | null
}

// One accepted header in the rewind window.
export interface ChainWindowEntry {
  hash: string
  work: bigint
}

export interface ValidatedHeaders {
  accepted: PersistedHeader[]
  work: bigint
}

// What survives after dropping a batch's leading headers we already hold:
// `height`/`hash` are where `rest` connects.
export interface TrimmedHeaders {
  rest: Uint8Array[]
  height: number
  hash: string
}

export type HeaderSyncPhase = 'connecting' | 'syncing-headers' | 'synced' | 'stopped'

export interface HeaderSyncWorkerStatus {
  phase: HeaderSyncPhase
  tipHeight: number
  tipHash: string | null
  estimatedChainHeight: number
  peerCount: number
}

export interface HeaderSyncWorkerOptions {
  chainStore: ChainStore
  peerPool: PoolService
  initialTipHeight: number
  initialTipHash: string
  // Highest ChainLock seen. Blocks at or below it are final, so no branch
  // forking below it is accepted. Moves via setFinalityHeight.
  finalityHeight: number
}