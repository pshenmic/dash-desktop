export interface PlatformSourceCandidate {
  platformAddress: string
  // Consensus keys inputs by the 21-byte PlatformAddress, so this is the order
  // a DeductFromInput index resolves against — not bech32m string order.
  addressBytes: Uint8Array
  index: number
  balanceCredits: bigint
  nonce: number
}

export interface PlatformInputSelection {
  candidate: PlatformSourceCandidate
  credits: bigint
}

export interface PlatformInputPlan {
  inputs: PlatformInputSelection[]
  feeCredits: bigint
  // Indexed against `inputs` as they are ordered here, which is the order the
  // transition is built in.
  feeStrategy: FeeStrategyStep[]
}

// The most of one address a transition may draw. Credits are divisible, so what
// it does not draw stays put — there is no change output to come back to.
export interface PlatformPickedInput {
  address: string
  credits: bigint
}

// Who pays the fee, by address: the index consensus resolves is a position in
// the byte-sorted input list, which only main can compute.
export type PlatformFeeStep =
  | {kind: 'deductFromInput'; address: string}
  | {kind: 'reduceOutput'; index: number}

// The protocol spelling of the same thing, and what the worker maps onto
// AddressFundsFeeStrategyStepWASM.
export type FeeStrategyStep =
  | {kind: 'deductFromInput'; index: number}
  | {kind: 'reduceOutput'; index: number}

// How a transition's funding was restricted: one address to draw from, or every
// address it may draw on, how much of each, and which one is charged.
export type PlatformSpendSource =
  | {kind: 'address'; address: string}
  | {kind: 'inputs'; inputs: PlatformPickedInput[]; feeStrategy: PlatformFeeStep[]}

// Either the inputs that fund an amount, or why none can. A quote asks before
// the amount is affordable, so "cannot fund" is an answer, not a failure.
export type PlatformInputOutcome =
  | {plan: PlatformInputPlan; error: null}
  | {plan: null; error: string}
