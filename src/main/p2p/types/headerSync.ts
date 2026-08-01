import type {ChainStore} from '../ChainStore'
import type {PoolService} from '../PoolService'

import type {Peer} from 'dash-core-p2p'

export interface HeaderRace {
  locator: string
  racers: Set<Peer>
  zeroResponses: number
  timer: ReturnType<typeof setTimeout> | null
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
}