import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {AssetLockProofParams} from '../../platform/types/messages'
import {AssetLockFundingStatus} from '../enums/AssetLockFundingStatus'

export type AssetLockFundingKind = 'address' | 'shielded' | 'identity' | 'identityTopUp'

export interface AssetLockFundingRow {
  id: number
  walletId: string
  txid: string
  outputIndex: number
  creditDerivationPath: string
  amountDuffs: string
  toPlatformAddress: string
  kind: AssetLockFundingKind
  status: AssetLockFundingStatus
  stHash: string | null
  error: string | null
  identityIndex: number | null
  txHex: string | null
  assetLockProof: AssetLockProofParams | null
  createdAt: number
}

export interface BroadcastedAssetLock {
  tx: SDKTransaction
  txid: string
  creditAddress: string
  creditDerivationPath: string
  inputAddresses: string[]
}

// What the asset-lock primitive needs from the wallet's L1 side. Coin
// selection, read providers and UTXOs belong to WalletService, which satisfies
// this as-is.
export interface AssetLockFunder {
  buildAndBroadcastAssetLock(
    walletId: string,
    amountDuffs: bigint,
    seed: Uint8Array,
    credit?: {address: string; derivationPath: string},
  ): Promise<BroadcastedAssetLock>
  waitForInstantLock(txid: string, timeoutMs: number): Promise<string | null>
}

export interface AcquiredAssetLock {
  row: AssetLockFundingRow
  proof: AssetLockProofParams
}

export interface AcquireParams {
  walletId: string
  kind: AssetLockFundingKind
  destination: string
  amountDuffs: bigint
  seed: Uint8Array
  credit?: {address: string; derivationPath: string}
  identityIndex?: number | null
}