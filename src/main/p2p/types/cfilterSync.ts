import type {Network} from '../../src/types'
import type {ChainStore} from '../ChainStore'
import type {PoolService} from '../PoolService'
import type {WalletSyncUtxo} from '../types/walletSync'

import {CFilterPhase} from '../../src/enums/CFilterPhase'

export {CFilterPhase}

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
  watchAddresses: string[]
  birthdayHeight: number
  // UTXO seed for the in-memory spend-detection map. Sourced from SQL by
  // main process before sending the start command — the worker never
  // reads wallet-scoped storage directly.
  seedUtxos: WalletSyncUtxo[]
  // Persisted cfilter scan cursor (null = never synced). Worker resumes
  // from max(birthday, cfilterCursor + 1).
  cfilterCursor: number | null
}