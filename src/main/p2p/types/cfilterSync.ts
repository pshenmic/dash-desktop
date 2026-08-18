import type {Network} from '../../src/types/Network'
import type {ChainStore} from '../ChainStore'
import type {PeerRotation} from '../peerRotation'
import type {PoolService} from '../PoolService'
import type {WalletSyncUtxo, WatchAddress} from './walletSync'

import type {Peer} from 'dash-core-p2p'

export interface BlockFetcherOptions {
  rotation: PeerRotation
  // PoolService.messages, whose factories dash-core-p2p does not type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any
}

export interface CheckpointAnchorsOptions {
  rotation: PeerRotation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any
  stopHashAt: (height: number) => Uint8Array | undefined
  onReady: (headers: Uint8Array[], fromPeer: Peer) => void
}

export interface CFilterBatch {
  startHeight: number
  stopHeight: number
  stopHashWire: Uint8Array
  remaining: Set<number>
  // Rotation memory, so a re-race reaches peers that have not been asked.
  triedPeers: Set<Peer>
  // The peers currently expected to answer. Emptied by disconnects, which is
  // how a request notices it has nobody left rather than waiting for its timer.
  inflightPeers: Set<Peer>
  // `remaining` when the timer was last armed. A batch arrives as CFILTER_BATCH
  // separate messages, so the question at each tick is whether any landed — not
  // whether the batch is done.
  remainingAtArm: number
  timer: ReturnType<typeof setTimeout> | null
}

export interface BlockRequest {
  hashWire: Uint8Array
  height: number
  triedPeers: Set<Peer>
  timer: ReturnType<typeof setTimeout> | null
}

export interface PendingCFHeaders {
  startHeight: number
  stopHeight: number
  triedPeers: Set<Peer>
  inflightPeers: Set<Peer>
  raceTimer: ReturnType<typeof setTimeout> | null
}

export type CFilterPhase =
  | 'connecting'
  | 'cfcheckpt'
  | 'cfheaders'
  | 'cfilters'
  | 'synced'
  | 'stopped'

export interface CFilterSyncWorkerStatus {
  phase: CFilterPhase
  cfheadersHeight: number
  cfilterScanHeight: number
  matchedBlocksPending: number
  peerCount: number
  filterCapablePeerCount: number
}

export interface CFilterSyncWorkerOptions {
  network: Network
  walletId: string
  chainStore: ChainStore
  peerPool: PoolService
  chainTipHeight: number
  chainTipHashDisplayHex: string
  watchAddresses: WatchAddress[]
  gapLimit: number
  birthdayHeight: number
  // UTXO seed for the in-memory spend-detection map. Sourced from SQL by
  // main process before sending the start command — the worker never
  // reads wallet-scoped storage directly.
  seedUtxos: WalletSyncUtxo[]
  // Persisted cfilter scan cursor (null = never synced). Worker resumes
  // from max(birthday, cfilterCursor + 1).
  cfilterCursor: number | null
}
