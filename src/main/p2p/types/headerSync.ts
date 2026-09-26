import type {ChainStore} from '../store/ChainStore'
import type {PoolService} from '../net/PoolService'
import type {PersistedHeader} from './chainStore'

import type {Peer} from 'dash-core-p2p'

export interface HeaderRace {
  // Kept for logging only: a response is validated by connecting it to the
  // recent-header window, not by matching what we asked for.
  locator: string[]
  // Tip the locator was built from. `getheaders` carries no request id, so this
  // is the only way to tell an answer to this race from one to the race before
  // it — the same peers are picked repeatedly and their responses overlap.
  expectedPrev: string
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

// A ChainLock as it arrives on the lock pool. The height alone cannot say
// whether the block it locks is the one we hold at that height.
export interface ChainLock {
  height: number
  hash: string
}

export interface HeaderSyncWorkerOptions {
  chainStore: ChainStore
  peerPool: PoolService
  initialTipHeight: number
  initialTipHash: string
  // Unverified: whether it locks the branch we resume on is decided against
  // chain.db once the window is loaded. Later locks arrive via noteChainLock.
  chainLock: ChainLock | null
}