import {AssetLockFundingStatus} from '../enums/AssetLockFundingStatus'
import {AssetLockFundingKind} from './AssetLock'

// The DIP-13 identity funding branches, m/9'/coin'/5'/usage'.
export type FundingKeyUsage = 'registration' | 'topUp'

// Which key owns an asset lock's credit output: an L1 wallet address (address
// fundings and shields) or one of the two identity funding branches.
export type AssetLockCreditSource = 'core' | FundingKeyUsage

export interface AssetLockCredit {
  address: string
  amountDuffs: bigint
}

export interface AssetLockCreditOwner {
  source: AssetLockCreditSource
  index: number
  derivationPath: string
}

// The only place a core lock's destination survives: the chain cannot tell an
// address funding from a shield.
export interface AssetLockRecordedFunding {
  status: AssetLockFundingStatus
  kind: AssetLockFundingKind
  to: string | null
}

// Read off our own lock pool, never DAPI: islocks are ephemeral around
// broadcast and chainlock height is ours to compare against, so this is what
// the wallet's own peers have actually told it, not what an indexer reports.
export interface AssetLockLockStatus {
  instantLocked: boolean
  chainLocked: boolean
}

export interface AssetLockInspection extends AssetLockCredit, AssetLockCreditOwner {
  txid: string
  allowedKinds: AssetLockFundingKind[]
  recorded: AssetLockRecordedFunding | null
  lockStatus: AssetLockLockStatus
  // Registration only: the identity this outpoint creates, and whether Platform
  // already has it.
  identityId: string | null
  identityExists: boolean | null
}

// The chain records who owns the credit, never where it goes: an address
// funding, a shield and a top-up are all decided by the transition that spends
// the lock.
export type AssetLockRecoveryDestination =
  | {kind: 'address' | 'shielded' | 'identityTopUp'; to: string}
  | {kind: 'identity'}
