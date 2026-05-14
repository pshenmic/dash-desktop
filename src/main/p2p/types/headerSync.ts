import type {ChainStore} from '../ChainStore'
import type {PoolService} from '../PoolService'

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