import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {AssetLockProofParams} from '../../platform/types/messages'
import {AssetLockFundingStatus} from '../enums/AssetLockFundingStatus'
import {Network} from './Network'
import {Transaction} from './Transaction'
import {TxLockStatus} from './TxLockStatus'

export type AssetLockFundingKind = 'address' | 'shielded' | 'identity' | 'identityTopUp'

export interface AssetLockFundingRow {
  id: number
  walletId: string
  txid: string
  outputIndex: number
  creditDerivationPath: string
  amountDuffs: bigint
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

export interface BuiltAssetLock {
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
  // Signing and broadcasting are separate so the funding row can be written
  // between them: the txid is known from the signed transaction, and a spend
  // nobody recorded cannot be resumed.
  buildAssetLock(
    walletId: string,
    amountDuffs: bigint,
    seed: Uint8Array,
    credit?: {address: string; derivationPath: string},
  ): Promise<BuiltAssetLock>
  broadcastAssetLock(txHex: string): Promise<void>
  waitForInstantLock(txid: string, timeoutMs: number): Promise<string | null>
  waitForChainLock(network: Network, minHeight: number, timeoutMs: number): Promise<number | null>
  chainlockedHeight(network: Network): number
  getTxLockStatus(walletId: string, txid: string): Promise<TxLockStatus>
  getTransaction(walletId: string, txid: string): Promise<Transaction>
  // Which of these have on-chain history. Provider-backed, so it answers in
  // both connection modes.
  getUsedAddresses(walletId: string, addresses: string[]): Promise<string[]>
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
