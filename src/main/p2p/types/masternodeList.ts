import type {FinalCommitment} from 'dash-core-p2p'
import type {PoolService} from '../net/PoolService'
import type {ChainStore} from '../store/ChainStore'
import type {SyncServiceEvents} from './sync'

export interface MasternodeListOptions {
  // Read on every call: the lock pool and chain.db each outlive the other.
  pool: () => PoolService | null
  chain: () => ChainStore | null
  events: Pick<SyncServiceEvents, 'evonodeDapiUrls' | 'platformQuorums'>
}

export interface QuorumSet {
  blockHash: string
  height: number
  commitments: FinalCommitment[]
}
