import {NodeStatus} from 'dash-platform-sdk/types.js'
import {Network} from '../../src/types/Network'

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

// Every operation the wallet can price, in the four groups that decide how.
// The groups are the whole fee model: a Core send pays a flat Dash rate, an
// asset lock pays that rate and again on L2 for the transition its proof funds,
// pool spends are priced by the pool, and the rest are priced from the
// transition they would build.
export type FeeOperation = 'coreSend' | PoolSpendOperation | TransitionFeeOperation

// Two transactions, so two fees: the L1 lock, then the L2 transition that
// spends its proof out of the credits the lock created.
export type AssetLockFeeOperation =
  | 'assetLockFunding'
  | 'assetLockShield'
  | 'identityRegister'
  | 'identityTopUpL1'

export type PoolSpendOperation =
  | 'shieldedTransfer'
  | 'unshield'
  | 'shieldedWithdrawal'
  | 'identityCreateFromPool'

export type TransitionFeeOperation =
  | 'addressFundsTransfer'
  | 'shield'
  | 'identityToAddress'
  | 'identityToIdentity'
  | 'identityWithdrawal'
  | AssetLockFeeOperation
  | SelectionFeeOperation

// Priced by building the transition and asking it, rather than by estimating
// over counts. Everything an asset lock funds is here: a proof cannot be
// estimated, only built.
export type BuiltTransitionOperation = Exclude<
  TransitionFeeOperation,
  'addressFundsTransfer' | 'addressWithdrawal' | 'shield' | 'assetLockShield'
>

// Funded by platform addresses, so the fee scales with the inputs the selection
// takes and the two have to resolve together.
export type SelectionFeeOperation =
  | 'addressWithdrawal'
  | 'identityCreate'
  | 'identityTopUp'

// What the user chose. Which fields an operation reads is the pricing switch's
// business — `recipient` is a platform address, an identity or a Core address
// depending on which one is being priced.
export interface FeeParams {
  amountCredits: bigint
  // Whatever kind of address this operation pays — a platform address, an
  // identity or a Core address. A list only where an operation pays several,
  // because each extra output costs the same again.
  recipient: string | string[]
  // Optional because most operations read none of them, and a caller spelling
  // out which fields it does not use says nothing about the fee.
  sourceAddress?: string | null
  identityId?: string | null
  // Pool spends only: restricts the spend to one shielded address's notes.
  noteIndexes?: number[] | null
}

// The same params, plus the two numbers only main can supply: how many inputs
// the selection settled on, and the Core rate the user's multiplier snapped to.
export interface FeeQuoteParams extends FeeParams {
  inputCount: number
  coreFeePerByte: number
}

// metered means consensus prices the transition at execution and feeCredits is
// only the floor. A shielded fee is exact, so nothing may be added to it.
export interface FeeQuote {
  feeCredits: bigint
  metered: boolean
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
      kind: PoolSpendOperation
      recipient: string
      amountCredits: bigint
      notes: EncryptedNotePayload[]
      // Restricts selection to specific pool indexes when the user picked notes.
      noteIndexes: number[] | null
      // identityCreate only.
      identityIndex: number | null
      failureAddress: string | null
      // withdrawal only; consensus requires a non-zero Fibonacci rate.
      coreFeePerByte: number
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
    payload: {operation: TransitionFeeOperation; params: FeeQuoteParams}
    result: FeeQuote
  }
  // Every note count a spend may settle on, so the caller can resolve the fee
  // and the count together without a round trip per candidate count.
  spendFeeCurve: {
    payload: {kind: PoolSpendOperation}
    result: {feeCredits: bigint[]}
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
    payload: {seed: Uint8Array; inputs: AddressInput[]; coreAddress: string; coreFeePerByte: number}
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
    payload: {
      seed: Uint8Array
      identifier: string
      identityIndex: number
      amountCredits: bigint
      coreAddress: string
      coreFeePerByte: number
    }
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
    // An alias costs a DPNS document search per identity, on top of the
    // identity fetch.
    payload: {identifiers: string[]; skipDPNS: boolean}
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
