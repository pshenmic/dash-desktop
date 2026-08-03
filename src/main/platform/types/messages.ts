import {NodeStatus} from 'dash-platform-sdk/types.js'
import {Network} from '../../src/types'

// Wire protocol for the dash-platform utility process. Envelope only — payload
// shapes live with their operations. Every terminal event echoes back the
// requestId its command carried.

export type ProverState = 'idle' | 'preparing' | 'ready' | 'error'
export type PoolState = 'idle' | 'discovering' | 'ready' | 'error'

// 'alreadyInChain' exists so main branches on a code instead of substring
// matching third-party error text.
export type PlatformErrorCode =
  | 'cancelled'
  | 'alreadyInChain'
  | 'insufficientFunds'
  | 'network'
  | 'internal'

export type PlatformPhase =
  | 'queued'
  | 'fetching'
  | 'recovering'
  | 'proving'
  | 'signing'
  | 'broadcasting'
  | 'awaitingResult'

export interface PlatformError {
  message: string
  // Set when the transition reached the network, so main can tell "retry is
  // safe" from "this may already be in a block".
  stHash: string | null
  code: PlatformErrorCode
}

export interface EncryptedNotePayload {
  index: number
  nullifier: Uint8Array
  cmx: Uint8Array
  encryptedNote: Uint8Array
  cvNet: Uint8Array
}

export type SpendKind = 'transfer' | 'unshield' | 'withdrawal' | 'identityCreate'

export interface NoteSnapshot {
  index: number
  amount: bigint
  spent: boolean
  address: string
}

export interface ShieldSource {
  platformAddress: string
  nonce: number
  balanceCredits: bigint
  index: number
}

// One platform address funding a transition: which address, its derivation
// index for signing, the nonce main read, and how much of it to spend.
export interface AddressInput {
  platformAddress: string
  index: number
  nonce: number
  credits: bigint
}

export interface AddressInfo {
  address: string
  balance: bigint
  nonce: number
}

export interface Recipient {
  address: string
  amountCredits: bigint
}

// What a transition costs before it exists. The first four kinds have a static
// estimator in dpp and are pure arithmetic; the last three have none, so the
// quote builds the transition and asks it — which is why they carry the same
// fields their operation does. Everything here is public: a quote never takes
// the seed, because the fee does not depend on the signature.
export type FeeQuery =
  | {kind: 'addressTransfer'; inputCount: number; recipients: string[]}
  | {kind: 'addressWithdrawal'; inputCount: number; hasChange: boolean}
  | {kind: 'shieldedSpend'; spendKind: SpendKind; noteCount: number; recipients: string[]}
  // Only the asset-lock shield has a transparent destination besides the pool:
  // its surplusOutput. The shield from platform addresses has none — leftover
  // input credits go to the fee strategy, not to a new address.
  | {kind: 'shield'; noteCount: number; fromAssetLock: boolean; surplusAddress: string | null}
  | {kind: 'identityCreditsToAddresses'; identityId: string; recipients: Recipient[]}
  | {kind: 'identityCreditTransfer'; identityId: string; recipientId: string; amountCredits: bigint}
  | {kind: 'identityWithdrawal'; identityId: string; amountCredits: bigint; coreAddress: string}
  | {kind: 'identityCreateFromAddresses'; inputs: AddressInput[]}
  | {kind: 'identityTopUpFromAddresses'; identityId: string; inputs: AddressInput[]}
  | {
      kind: 'addressFundingFromAssetLock'
      assetLockProof: AssetLockProofParams
      txid: string
      outputIndex: number
      recipient: string
    }

// A recipient that is not in state yet has its balance entry created by this
// transition, and GroveDB charges that storage on top of the minimum — which
// is why the first payment to an address costs more than every later one.
export interface FeeQuote {
  minFeeCredits: bigint
  storageFeeCredits: bigint
  totalFeeCredits: bigint
  newAddresses: string[]
}

export type AssetLockProofParams =
  | {type: 'chainLock'; coreChainLockedHeight: number}
  | {type: 'instantLock'; instantLock: string; transaction: string}

// Common half of every transition funded by an asset lock. Main resolves the
// proof (the islock arrives on our own p2p pool) and the worker only consumes
// it — the credit key is derived here from the seed and the path main recorded.
export interface AssetLockFunded {
  seed: Uint8Array
  txid: string
  outputIndex: number
  assetLockProof: AssetLockProofParams
  creditDerivationPath: string
}

// The operation catalogue. `laneFor` in ../constants.ts switches over the same
// union, so a new kind that forgets its lane fails to compile.
//
// The seed crosses as raw bytes; the mnemonic and the password never do, and no
// operation retains the seed past the request that carried it.
export interface PlatformOperations {
  warmup: {
    payload: Record<string, never>
    result: {prover: ProverState}
  }
  sync: {
    payload: {seed: Uint8Array; notes: EncryptedNotePayload[]}
    result: {balance: bigint; notes: NoteSnapshot[]}
  }
  spend: {
    payload: {
      seed: Uint8Array
      kind: SpendKind
      recipient: string
      amountCredits: bigint
      notes: EncryptedNotePayload[]
      // Restricts selection to specific pool indexes when the user picked notes.
      noteIndexes: number[] | null
      // identityCreate only.
      identityIndex: number | null
      failureAddress: string | null
    }
    result: {stHash: string; identityId: string | null; feeCredits: bigint | null}
  }
  shield: {
    payload: {seed: Uint8Array; source: ShieldSource; recipient: string; amountCredits: bigint}
    result: {stHash: string}
  }
  shieldFromAssetLock: {
    payload: AssetLockFunded & {
      recipient: string
      shieldAmountCredits: bigint
      surplusAddress: string | null
    }
    result: {stHash: string}
  }
  addressFundingFromAssetLock: {
    payload: AssetLockFunded & {recipient: string}
    result: {stHash: string}
  }
  identityCreateFromAssetLock: {
    payload: AssetLockFunded & {identityIndex: number}
    result: {stHash: string; identifier: string}
  }
  identityTopUpFromAssetLock: {
    payload: AssetLockFunded & {identifier: string}
    result: {stHash: string}
  }
  transitionFee: {
    payload: {query: FeeQuery}
    result: FeeQuote
  }
  addressInfos: {
    payload: {addresses: string[]}
    // An address absent from `infos` is unused. A failed lookup rejects rather
    // than reporting zeros, which would read as "no funds".
    result: {infos: AddressInfo[]}
  }
  addressTransfer: {
    payload: {seed: Uint8Array; input: AddressInput; recipient: string; amountCredits: bigint}
    result: {stHash: string}
  }
  addressWithdrawal: {
    payload: {seed: Uint8Array; inputs: AddressInput[]; coreAddress: string}
    result: {stHash: string}
  }
  identityCreateFromAddresses: {
    payload: {seed: Uint8Array; identityIndex: number; inputs: AddressInput[]}
    result: {stHash: string; identifier: string}
  }
  identityTopUpFromAddresses: {
    payload: {seed: Uint8Array; identifier: string; inputs: AddressInput[]}
    result: {stHash: string}
  }
  identityCreditsToAddresses: {
    payload: {seed: Uint8Array; identifier: string; identityIndex: number; recipients: Recipient[]}
    result: {stHash: string}
  }
  identityCreditTransfer: {
    payload: {seed: Uint8Array; identifier: string; identityIndex: number; recipientIdentifier: string; amountCredits: bigint}
    result: {stHash: string}
  }
  identityWithdrawal: {
    payload: {seed: Uint8Array; identifier: string; identityIndex: number; amountCredits: bigint; coreAddress: string}
    result: {stHash: string}
  }
  identityExists: {
    payload: {identifier: string}
    result: {exists: boolean}
  }
  identityBalance: {
    payload: {identifier: string}
    result: {credits: bigint}
  }
  identityNonce: {
    payload: {identifier: string}
    result: {nonce: bigint}
  }
  identityInfos: {
    payload: {identifiers: string[]}
    // Identifiers Platform does not know are omitted, not reported as zero.
    result: {infos: Array<{identifier: string; balance: bigint; alias: string | null}>}
  }
  identityScan: {
    payload: {seed: Uint8Array; startIndex: number; gapLimit: number; scanLimit: number}
    result: {identities: Array<{index: number; identifier: string}>; nextFreeIndex: number}
  }
  nodeStatus: {
    payload: Record<string, never>
    result: NodeStatus
  }
  poolInfo: {
    payload: Record<string, never>
    result: {poolState: bigint | null; notesCount: bigint | null}
  }
  notesCount: {
    payload: Record<string, never>
    result: {count: bigint | null}
  }
  encryptedNotes: {
    payload: {startIndex: number; count: number}
    result: {notes: EncryptedNotePayload[]}
  }
}

export type PlatformKind = keyof PlatformOperations
export type PlatformPayload<K extends PlatformKind> = PlatformOperations[K]['payload']
export type PlatformOperationResult<K extends PlatformKind> = PlatformOperations[K]['result']

export interface PlatformRequest<K extends PlatformKind = PlatformKind> {
  type: 'request'
  requestId: string
  kind: K
  network: Network
  payload: PlatformPayload<K>
}

export type PlatformRequestMessage = {[K in PlatformKind]: PlatformRequest<K>}[PlatformKind]

// Best-effort: honoured at await points only. It cannot abort a running Halo2
// proof or an in-flight gRPC call.
export interface PlatformCancel {
  type: 'cancel'
  requestId: string
}

export type PlatformCommand = PlatformRequestMessage | PlatformCancel

export type PlatformResponse =
  | {type: 'response'; requestId: string; ok: true; result: unknown}
  | {type: 'response'; requestId: string; ok: false; error: PlatformError}

// notesSpent is its own event rather than part of the response because the
// observation must survive a request that later fails. The worker reports what
// it saw; main decides what it writes.
export type PlatformEvent =
  | PlatformResponse
  | {type: 'progress'; requestId: string; phase: PlatformPhase; fetched: number; total: number}
  | {type: 'notesSpent'; requestId: string; indexes: number[]}
  | {type: 'status'; status: PlatformWorkerStatus}
  | {type: 'error'; message: string}

export interface PlatformNetworkStatus {
  pool: PoolState
  error: string | null
}

// inFlight is a value so health surfaces read it instead of triggering work —
// getShieldedStatus used to dispatch initProver as a side effect.
export interface PlatformWorkerStatus {
  prover: ProverState
  proverError: string | null
  networks: Record<Network, PlatformNetworkStatus>
  inFlight: {prover: number; signer: number; read: number}
  updatedAt: number
}

export const emptyPlatformStatus = (): PlatformWorkerStatus => ({
  prover: 'idle',
  proverError: null,
  networks: {
    mainnet: {pool: 'idle', error: null},
    testnet: {pool: 'idle', error: null},
  },
  inFlight: {prover: 0, signer: 0, read: 0},
  updatedAt: Date.now(),
})