import type {ChainStore} from '../ChainStore'
import type {PoolService} from '../PoolService'

import {HeaderSyncPhase} from '../../src/enums/HeaderSyncPhase'

export {HeaderSyncPhase}

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