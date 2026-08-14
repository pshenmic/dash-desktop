import type {ChainStore} from '../ChainStore'
import type {PoolService} from '../PoolService'

import type {Peer} from 'dash-core-p2p'

export interface HeaderRace {
  // Tip-first locator hashes, kept for logging: a response is validated by
  // connecting it to the recent-header window, not by matching what we asked.
  locator: string[]
  racers: Set<Peer>
  zeroResponses: number
  timer: ReturnType<typeof setTimeout> | null
}

// One accepted header in the rewind window, carrying what branch selection
// needs: its identity and its contribution to cumulative work.
export interface ChainWindowEntry {
  hash: string
  work: bigint
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
  // Highest ChainLock seen so far. Blocks at or below it are final, so no
  // branch that forks below it is ever accepted. Moves via setFinalityHeight
  // as clsig arrives on the lock pool.
  finalityHeight: number
}